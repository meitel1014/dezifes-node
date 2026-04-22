import './env';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { NodeCG } from './nodecg';
import { loadTeamsPoolFromCsv } from './loadTeams';
import { loadWeaponAliasesFromCsv } from './weaponAliases';
import { appendWeaponCsv, appendWeaponGoogleSheet } from './appendWeapon';
import { appendResultCsv, appendResultGoogleSheet } from './appendResult';
import { startScreenshotWatcher } from './screenshotWatcher';
import { pushToQueue } from './candidateQueue';
import { loadWeaponTemplates } from './ocr/matchWeapon';
import { processScreenshot } from './ocr/processScreenshot';
import type { Match, PickCandidate } from '../schemas';
import type { Mode } from '../nodecg/messages';


type PicksTuple = [PickCandidate, PickCandidate, PickCandidate, PickCandidate];
type ConfirmedPicks = Match['alpha']['picks'];

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

  const getScreenshotAbsDir = () =>
    path.resolve(process.cwd(), screenshotDirRep.value ?? 'data/screenshots');

  // スクショ監視を起動（ディレクトリ変更時は再起動）
  let watcherHandle = startScreenshotWatcher({
    screenshotDir: screenshotDirRep.value ?? 'data/screenshots',
    activeModeRep,
    teamsPoolRep,
    selectionRep,
    visibilityRep,
    matchCandidatesRep,
    log,
  });

  screenshotDirRep.on('change', (newDir) => {
    watcherHandle.stop();
    watcherHandle = startScreenshotWatcher({
      screenshotDir: newDir ?? 'data/screenshots',
      activeModeRep,
      teamsPoolRep,
      selectionRep,
      visibilityRep,
      matchCandidatesRep,
      log,
    });
    log.info(`Screenshot watcher restarted: ${newDir ?? 'data/screenshots'}`);
  });

  // NodeCG の HTTP listen 完了後にブキテンプレートを事前ロード。
  // 初回 OCR 実行時の待ち時間を削減するため。
  setImmediate(() => {
    void loadWeaponTemplates(log.warn.bind(log)).then((t) => {
      if (t.length === 0) {
        log.warn('Weapon templates loaded: 0 (weapon matching will be skipped; check data/weapon_flat_10_0_0/)');
      } else {
        log.info(`Weapon templates loaded: ${t.length}`);
      }
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

  // ダッシュボードから PNG をドロップして OCR を手動起動するためのアップロードエンドポイント
  // POST /upload-screenshot?mode=turfWar  (body: raw PNG binary)
  nodecg.mount('/upload-screenshot', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const modeParam = req.query['mode'];
    const mode: Mode | null =
      modeParam === 'turfWar' || modeParam === 'splatZones' ? modeParam : null;
    if (!mode) {
      res.status(400).json({ error: 'invalid mode' });
      return;
    }

    const selection = selectionRep.value;
    const pool = teamsPoolRep.value;
    if (!selection || !pool) {
      res.status(503).json({ error: 'replicants not ready' });
      return;
    }

    // watcher が同ファイルを二重処理しないよう先にマーク
    const filename = `manual-${Date.now()}.png`;
    watcherHandle.markProcessed(filename);

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const absDir = getScreenshotAbsDir();
      try {
        fs.writeFileSync(path.join(absDir, filename), Buffer.concat(chunks));
      } catch (e) {
        log.error('[upload] ファイル保存失敗', e);
        res.status(500).json({ error: 'write failed' });
        return;
      }

      // 202 をすぐ返し、OCR は非同期で実行
      res.status(202).json({ filename });

      log.info(`[upload] OCR start: ${filename} (mode=${mode})`);
      void processScreenshot({
        screenshotPath: path.join(absDir, filename),
        sourceFile: filename,
        mode,
        selection,
        teamsPool: pool,
        log,
      }).then((cand) => {
        if (!cand) {
          log.warn(`[upload] OCR skipped: ${filename} — アルファ/ブラボー チームが選択されていません`);
          return;
        }
        const cur = matchCandidatesRep.value ?? { turfWar: [], splatZones: [] };
        matchCandidatesRep.value = pushToQueue(cur, mode, cand);
        log.info(`[upload] OCR done: ${filename} (mode=${mode})`);
      }).catch((e) => log.error(`[upload] OCR 失敗: ${filename}`, e));
    });

    req.on('error', (e) => {
      log.error('[upload] リクエストエラー', e);
    });
  });

  // OBSから勝利メッセージを受信するエンドポイント
  // POST /battle-result  (body: alpha-win or bravo-win (text/plain))
  nodecg.mount('/battle-result', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const mode = activeModeRep.value;
    const selection = selectionRep.value;
    if (!mode || !selection) {
      res.status(503).json({ error: 'replicants not ready' });
      return;
    }

    const result: string = req.body;
    if (!(result in ['alpha_win', 'bravo_win'])) {
      log.error('[battle-result] 試合結果受信エラー:' + result);
      res.status(500).json({ error: 'invalid result' });
      return;
    }

    try {
      appendResultCsv(selection, mode, result);
      log.info(`Result confirmed: ${result} -> data/results.csv`);
    } catch (e) {
      log.error('Failed to append results.csv', e);
    }

    if (googleSheetSyncRep.value && gasEndpointUrl) {
      appendResultGoogleSheet(selection, mode, result, gasEndpointUrl)
        .then(() => log.info(`Result synced to Google Sheet: ${result}`))
        .catch((e) => log.error('Failed to append to Google Sheet', e));
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

    const match: Match = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      mode,
      sourceFile: cand.sourceFile,
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
      appendWeaponCsv(match, teamsPoolRep.value ?? null, weaponAliasesRep.value ?? null);
      log.info(`Match confirmed: ${match.id} (${mode}) -> data/matches.csv`);
    } catch (e) {
      log.error('Failed to append matches.csv', e);
    }

    if (googleSheetSyncRep.value && gasEndpointUrl) {
      appendWeaponGoogleSheet(match, teamsPoolRep.value ?? null, weaponAliasesRep.value ?? null, gasEndpointUrl)
        .then(() => log.info(`Match synced to Google Sheet: ${match.id}`))
        .catch((e) => log.error('Failed to append to Google Sheet', e));
    }

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

  nodecg.listenFor('reloadWeaponAliases', (_data, ack) => {
    weaponAliasesRep.value = loadWeaponAliasesFromCsv();
    log.info(
      `Reloaded weapon aliases: ${Object.keys(weaponAliasesRep.value ?? {}).length} entries`
    );
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


