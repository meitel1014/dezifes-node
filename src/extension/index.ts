import './env';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import type { NodeCG } from './nodecg';
import { loadTeamsPoolFromCsv } from './loadTeams';
import { loadWeaponAliasesFromCsv } from './weaponAliases';
import { loadInGameNamesFromCsv } from './loadInGameNames';
import { appendRecordCsv, appendRecordGoogleSheet } from './appendRecord';
import { pushToQueue } from './candidateQueue';
import { loadWeaponTemplates } from './ocr/matchWeapon';
import { loadStageTemplates, matchStage, getCachedStageNames } from './ocr/matchStage';
import { processScreenshot } from './ocr/processScreenshot';
import type { Match, PickCandidate } from '../schemas';
import type { Mode } from '../nodecg/messages';


type PicksTuple = [PickCandidate, PickCandidate, PickCandidate, PickCandidate];
type ConfirmedPicks = Match['alpha']['picks'];

type StageResult = { stageName: string; score: number; allScores: { stageName: string; score: number }[] };
// /stage で受信した最新ステージ候補をモード別に一時保持（Replicantは不要）
const latestStageCandidate: Record<Mode, StageResult | null> = {
  turfWar: null,
  splatZones: null,
};

export default (nodecg: NodeCG) => {
  const log = new nodecg.Logger('dezifes');
  log.info('=====Extension is running=====');

  const teamsPoolRep = nodecg.Replicant('teamsPool');
  const selectionRep = nodecg.Replicant('selection');
  const visibilityRep = nodecg.Replicant('visibility');
  const matchesRep = nodecg.Replicant('matches');
  const matchCandidatesRep = nodecg.Replicant('matchCandidates');
  const weaponAliasesRep = nodecg.Replicant('weaponAliases');
  const screenshotDirRep = nodecg.Replicant('screenshotDir');
  const googleSheetSyncRep = nodecg.Replicant('googleSheetSync');
  const gasEndpointConfiguredRep = nodecg.Replicant('gasEndpointConfigured');
  const activeModeRep = nodecg.Replicant('activeMode');
  const stageNamesRep = nodecg.Replicant('stageNames');
  const inGameNamesRep = nodecg.Replicant('inGameNames');

  const gasEndpointUrl = process.env['GAS_ENDPOINT_URL'];
  gasEndpointConfiguredRep.value = !!gasEndpointUrl;

  // 初回起動時のみ CSV から teamsPool を初期化。
  const isEmptyPool = (pool: typeof teamsPoolRep.value) =>
    !pool || (pool.turfWar.length === 0 && pool.splatZones.length === 0);

  if (isEmptyPool(teamsPoolRep.value)) {
    const loaded = loadTeamsPoolFromCsv();
    teamsPoolRep.value = loaded;
    log.info(
      `Loaded teams from CSV: turfWar=${loaded.turfWar.length}, splatZones=${loaded.splatZones.length}`
    );
  }

  // 初回起動時のみ CSV からブキ対応表を初期化。永続化された値があればスキップ。
  if (Object.keys(weaponAliasesRep.value ?? {}).length === 0) {
    weaponAliasesRep.value = loadWeaponAliasesFromCsv();
    log.info(
      `Loaded weapon aliases: ${Object.keys(weaponAliasesRep.value ?? {}).length} entries`
    );
  }

  // ゲーム内名前対応表は常に CSV から初期化（編集後も再起動で CSV に戻す）。
  inGameNamesRep.value = loadInGameNamesFromCsv();
  log.info(`Loaded in-game names: ${Object.keys(inGameNamesRep.value ?? {}).length} entries`);

  const getScreenshotAbsDir = () =>
    path.resolve(process.cwd(), screenshotDirRep.value ?? 'data/screenshots');

  // NodeCG の HTTP listen 完了後にブキ・ステージテンプレートを事前ロード。
  setImmediate(() => {
    void loadWeaponTemplates(log.warn.bind(log)).then((t) => {
      if (t.length === 0) {
        log.warn('Weapon templates loaded: 0 (weapon matching will be skipped; check data/weapon_flat_10_0_0/)');
      } else {
        log.info(`Weapon templates loaded: ${t.length}`);
      }
    });

    void Promise.all([
      loadStageTemplates('turfWar', log.warn.bind(log)),
      loadStageTemplates('splatZones', log.warn.bind(log)),
    ]).then(() => {
      stageNamesRep.value = {
        turfWar: getCachedStageNames('turfWar'),
        splatZones: getCachedStageNames('splatZones'),
      };
      log.info(
        `Stage templates loaded: turfWar=${getCachedStageNames('turfWar').length}, splatZones=${getCachedStageNames('splatZones').length}`
      );
    });
  });

  // アノテーション済み画像を /annotated-screenshots/{filename} で配信
  nodecg.mount('/annotated-screenshots', (req, res) => {
    const filename = path.basename(decodeURIComponent(req.path));
    const filePath = path.join(getScreenshotAbsDir(), 'annotated', filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
  });

  // OBS・外部ツールから base64 PNG を受け取り OCR を実行するエンドポイント
  // POST /weapons  (body: <raw base64 PNG>, Content-Type: text/plain)
  nodecg.mount('/weapons', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const mode: Mode = activeModeRep.value ?? 'turfWar';

    const selection = selectionRep.value;
    const pool = teamsPoolRep.value;
    if (!selection || !pool) {
      res.status(503).json({ error: 'replicants not ready' });
      return;
    }

    const filename = `weapons-${Date.now()}.png`;

    // NodeCG の global JSON body-parser（100kb 制限）を回避するためストリームで収集
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const content = Buffer.concat(chunks).toString('utf8').trim();
      if (!content) {
        res.status(400).json({ error: 'empty body' });
        return;
      }

      const pngBuffer = Buffer.from(content, 'base64');
      const absDir = getScreenshotAbsDir();
      try {
        fs.writeFileSync(path.join(absDir, filename), pngBuffer);
      } catch (e) {
        log.error('[weapons] ファイル保存失敗', e);
        res.status(500).json({ error: 'write failed' });
        return;
      }

      res.status(202).end();

      log.info(`[weapons] OCR start: ${filename} (mode=${mode})`);
      void processScreenshot({
        screenshotPath: path.join(absDir, filename),
        sourceFile: filename,
        mode,
        selection,
        teamsPool: pool,
        log,
        stageCandidate: latestStageCandidate[mode],
        inGameNames: inGameNamesRep.value ?? null,
      }).then((cand) => {
        if (!cand) {
          log.warn(`[weapons] OCR skipped: ${filename} — アルファ/ブラボー チームが選択されていません`);
          return;
        }
        const cur = matchCandidatesRep.value ?? { turfWar: [], splatZones: [] };
        matchCandidatesRep.value = pushToQueue(cur, mode, cand);
        log.info(`[weapons] OCR done: ${filename} (mode=${mode})`);
      }).catch((e) => log.error(`[weapons] OCR 失敗: ${filename}`, e));
    });

    req.on('error', (e) => {
      log.error('[weapons] リクエストエラー', e);
    });
  });

  // OBSから試合開始時のステージ画面を受け取りステージを自動判別するエンドポイント
  // POST /stage  (body: <raw base64 PNG>, Content-Type: text/plain)
  nodecg.mount('/stage', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const mode: Mode = activeModeRep.value ?? 'turfWar';
    const filename = `stage-${Date.now()}.png`;

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const content = Buffer.concat(chunks).toString('utf8').trim();
      if (!content) {
        res.status(400).json({ error: 'empty body' });
        return;
      }

      const pngBuffer = Buffer.from(content, 'base64');
      const absDir = getScreenshotAbsDir();
      try {
        fs.writeFileSync(path.join(absDir, filename), pngBuffer);
      } catch (e) {
        log.error('[stage] ファイル保存失敗', e);
        res.status(500).json({ error: 'write failed' });
        return;
      }

      res.status(202).end();

      log.info(`[stage] matching start: ${filename} (mode=${mode})`);
      void (async () => {
        try {
          const meta = await sharp(path.join(absDir, filename)).metadata();
          const w = meta.width ?? 1920;
          const h = meta.height ?? 1080;
          const ranked = await matchStage(path.join(absDir, filename), mode, w, h, log.warn.bind(log));
          if (ranked.length > 0) {
            latestStageCandidate[mode] = { stageName: ranked[0].stageName, score: ranked[0].score, allScores: ranked };
            log.info(`[stage] best match: "${ranked[0].stageName}" score=${(ranked[0].score * 100).toFixed(1)}% (mode=${mode})`);
          } else {
            latestStageCandidate[mode] = null;
            log.warn(`[stage] ステージテンプレートが見つかりません (mode=${mode})`);
          }
        } catch (e) {
          log.error(`[stage] 失敗: ${filename}`, e);
          latestStageCandidate[mode] = null;
        }
      })();
    });

    req.on('error', (e) => {
      log.error('[stage] リクエストエラー', e);
    });
  });

  // OBSから勝利メッセージを受信するエンドポイント
  // POST /result  (body: result: alpha_win or bravo_win (application/json))
  // 受信した勝利サイドを現在モードの先頭候補に反映する（CSV/GAS送信は「確定して記録」で行う）
  nodecg.mount('/result', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const mode = activeModeRep.value;
    if (!mode) {
      res.status(503).json({ error: 'replicants not ready' });
      return;
    }

    const result: string = req.body.result;
    if (!['alpha_win', 'bravo_win'].includes(result)) {
      log.error('[result] 試合結果受信エラー:' + result);
      res.status(400).json({ error: 'invalid result' });
      return;
    }

    res.status(202).end();

    const wonSide = result === 'alpha_win' ? 'alpha' : 'bravo';
    const cands = matchCandidatesRep.value;
    const queue = cands?.[mode] ?? [];
    if (queue.length > 0 && cands) {
      const updated = { ...queue[0], wonSide } as typeof queue[0];
      matchCandidatesRep.value = {
        ...cands,
        [mode]: [updated, ...queue.slice(1)],
      };
      log.info(`[result] wonSide set to '${wonSide}' on ${mode}[0]`);
    } else {
      log.info(`[result] received '${result}' but no candidates in ${mode} queue`);
    }

    res.status(200).end();
  });

  // ── Message ハンドラ ───────────────────────────────────

  nodecg.listenFor('reloadTeamsCsv', (_data, ack) => {
    const loaded = loadTeamsPoolFromCsv();
    teamsPoolRep.value = loaded;
    log.info(
      `Reloaded teams from CSV: turfWar=${loaded.turfWar.length}, splatZones=${loaded.splatZones.length}`
    );
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('resetMode', ({ mode }, ack) => {
    const vis = visibilityRep.value ?? {
      turfWar: { alpha: false, bravo: false },
      splatZones: { alpha: false, bravo: false },
    };
    visibilityRep.value = {
      ...vis,
      [mode]: { alpha: false, bravo: false },
    };

    const sel = selectionRep.value ?? {
      turfWar: { alpha: null, bravo: null },
      splatZones: { alpha: null, bravo: null },
    };
    selectionRep.value = {
      ...sel,
      [mode]: { alpha: null, bravo: null },
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('updateTeam', ({ mode, teamId, patch }, ack) => {
    const pool = teamsPoolRep.value;
    if (!pool) {
      if (ack && !ack.handled) ack(null);
      return;
    }
    const list = pool[mode];
    const idx = list.findIndex((t) => t.id === teamId);
    if (idx < 0) {
      log.warn(`updateTeam: teamId="${teamId}" not found in ${mode}`);
      if (ack && !ack.handled) ack(null);
      return;
    }

    const prev = list[idx];
    const updated = { ...prev, ...patch };
    if (patch.players) {
      updated.players = [
        patch.players[0] ?? prev.players[0],
        patch.players[1] ?? prev.players[1],
        patch.players[2] ?? prev.players[2],
        patch.players[3] ?? prev.players[3],
      ];
    }

    const newList = [...list];
    newList[idx] = updated;
    teamsPoolRep.value = { ...pool, [mode]: newList };
    if (ack && !ack.handled) ack(null);
  });

  // 判定結果候補の 1 マスを手動修正（playerName/weaponId の差分を反映）
  nodecg.listenFor('updateMatchCandidate', ({ mode, candidateIndex, side, position, patch }, ack) => {
    const cands = matchCandidatesRep.value;
    const queue = cands?.[mode] ?? [];
    const cand = queue[candidateIndex];
    if (!cands || !cand) {
      if (ack && !ack.handled) ack(null);
      return;
    }

    const sideData = cand[side];
    const newPicks = replacePick(sideData.picks, position, (p) => ({
      ...p,
      selected: {
        playerName: patch.playerName ?? p.selected.playerName,
        weaponId: patch.weaponId ?? p.selected.weaponId,
      },
    }));

    const updatedCand = { ...cand, [side]: { ...sideData, picks: newPicks } };
    matchCandidatesRep.value = {
      ...cands,
      [mode]: queue.map((c, i) => (i === candidateIndex ? updatedCand : c)),
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('confirmMatchCandidate', ({ mode, candidateIndex }, ack) => {
    const cands = matchCandidatesRep.value;
    const queue = cands?.[mode] ?? [];
    const cand = queue[candidateIndex];
    if (!cands || !cand) {
      if (ack && !ack.handled) ack(null);
      return;
    }

    if (!cand.wonSide) {
      if (ack && !ack.handled) ack(new Error('勝利チームが未選択です'));
      return;
    }
    const wonSide = cand.wonSide;

    const match: Match = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      mode,
      sourceFile: cand.sourceFile,
      stageName: cand.stageName ?? null,
      alpha: {
        teamId: cand.alpha.teamId,
        picks: toConfirmedPicks(cand.alpha.picks),
      },
      bravo: {
        teamId: cand.bravo.teamId,
        picks: toConfirmedPicks(cand.bravo.picks),
      },
    };

    matchesRep.value = [...(matchesRep.value ?? []), match];
    matchCandidatesRep.value = {
      ...cands,
      [mode]: queue.filter((_, i) => i !== candidateIndex),
    };

    try {
      appendRecordCsv(match, wonSide, teamsPoolRep.value ?? null, weaponAliasesRep.value ?? null);
      log.info(`Match confirmed: ${match.id} (${mode}, ${wonSide}) -> data/records.csv`);
    } catch (e) {
      log.error('Failed to append records.csv', e);
    }

    if (googleSheetSyncRep.value && gasEndpointUrl) {
      appendRecordGoogleSheet(match, wonSide, teamsPoolRep.value ?? null, weaponAliasesRep.value ?? null, gasEndpointUrl)
        .then(() => log.info(`Match synced to Google Sheet: ${match.id}`))
        .catch((e: unknown) => log.error('Failed to append to Google Sheet', e));
    }

    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('setMatchCandidateWonSide', ({ mode, candidateIndex, wonSide }, ack) => {
    const cands = matchCandidatesRep.value;
    const queue = cands?.[mode] ?? [];
    const cand = queue[candidateIndex];
    if (!cands || !cand) {
      if (ack && !ack.handled) ack(null);
      return;
    }
    matchCandidatesRep.value = {
      ...cands,
      [mode]: queue.map((c, i) => (i === candidateIndex ? { ...c, wonSide } : c)),
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('dismissMatchCandidate', ({ mode, candidateIndex }, ack) => {
    const cands = matchCandidatesRep.value;
    if (!cands) {
      if (ack && !ack.handled) ack(null);
      return;
    }
    const queue = cands[mode] ?? [];
    matchCandidatesRep.value = {
      ...cands,
      [mode]: queue.filter((_, i) => i !== candidateIndex),
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('deleteMatch', ({ id }, ack) => {
    const list = matchesRep.value ?? [];
    matchesRep.value = list.filter((m) => m.id !== id);
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('setMatchCandidateStageName', ({ mode, candidateIndex, stageName }, ack) => {
    const cands = matchCandidatesRep.value;
    const queue = cands?.[mode] ?? [];
    if (!cands || !queue[candidateIndex]) {
      if (ack && !ack.handled) ack(null);
      return;
    }
    matchCandidatesRep.value = {
      ...cands,
      [mode]: queue.map((c, i) => (i === candidateIndex ? { ...c, stageName } : c)),
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('reloadWeaponAliases', (_data, ack) => {
    weaponAliasesRep.value = loadWeaponAliasesFromCsv();
    log.info(
      `Reloaded weapon aliases: ${Object.keys(weaponAliasesRep.value ?? {}).length} entries`
    );
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('reloadInGameNamesCsv', (_data, ack) => {
    inGameNamesRep.value = loadInGameNamesFromCsv();
    log.info(
      `Reloaded in-game names: ${Object.keys(inGameNamesRep.value ?? {}).length} entries`
    );
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('setInGameName', ({ playerName, inGameName }, ack) => {
    inGameNamesRep.value = { ...(inGameNamesRep.value ?? {}), [playerName]: inGameName };
    if (ack && !ack.handled) ack(null);
  });

};

function replacePick(
  picks: PicksTuple,
  position: 0 | 1 | 2 | 3,
  patch: (p: PickCandidate) => PickCandidate
): PicksTuple {
  return [
    position === 0 ? patch(picks[0]) : picks[0],
    position === 1 ? patch(picks[1]) : picks[1],
    position === 2 ? patch(picks[2]) : picks[2],
    position === 3 ? patch(picks[3]) : picks[3],
  ];
}

function toConfirmedPicks(picks: PicksTuple): ConfirmedPicks {
  return [
    { ...picks[0].selected },
    { ...picks[1].selected },
    { ...picks[2].selected },
    { ...picks[3].selected },
  ];
}


