import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { NodeCG } from './nodecg';
import { loadTeamsPoolFromCsv } from './loadTeams';
import {
  generateWeaponAliasesCsv,
  loadWeaponAliasesFromCsv,
} from './weaponAliases';
import { appendMatchCsv } from './appendMatchCsv';
import { startScreenshotWatcher } from './screenshotWatcher';
import { loadWeaponTemplates } from './ocr/matchWeapon';
import type { Match, MatchCandidate, PickCandidate } from '../schemas';

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

  // スクショ監視を起動
  const screenshotDir = nodecg.bundleConfig?.screenshotDir ?? 'data/screenshots';
  startScreenshotWatcher({
    screenshotDir,
    teamsPoolRep,
    selectionRep,
    visibilityRep,
    matchCandidatesRep,
    log,
  });

  // NodeCG の HTTP listen 完了後にブキテンプレートを事前ロード。
  // 初回 OCR 実行時の待ち時間を削減するため。
  setImmediate(() => {
    void loadWeaponTemplates().then((t) => log.info(`Weapon templates loaded: ${t.length}`));
  });

  // アノテーション済み画像を /annotated-screenshots/{filename} で配信
  const annotatedDir = path.resolve(process.cwd(), screenshotDir, 'annotated');
  nodecg.mount('/annotated-screenshots', (req, res) => {
    const filename = path.basename(decodeURIComponent(req.path));
    const filePath = path.join(annotatedDir, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
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
    if (!pool) return;
    const list = pool[mode];
    const idx = list.findIndex((t) => t.id === teamId);
    if (idx < 0) return;

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
  nodecg.listenFor('updateMatchCandidate', ({ mode, side, position, patch }, ack) => {
    const cands = matchCandidatesRep.value;
    if (!cands) return;
    const cand = cands[mode];
    if (!cand) return;

    const sideData = cand[side];
    const newPicks = replacePick(sideData.picks, position, (p) => ({
      ...p,
      selected: {
        playerName: patch.playerName ?? p.selected.playerName,
        weaponId: patch.weaponId ?? p.selected.weaponId,
      },
    }));

    matchCandidatesRep.value = {
      ...cands,
      [mode]: {
        ...cand,
        [side]: { ...sideData, picks: newPicks },
      },
    };
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('confirmMatchCandidate', ({ mode }, ack) => {
    const cands = matchCandidatesRep.value;
    if (!cands) return;
    const cand = cands[mode];
    if (!cand) return;

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
    matchCandidatesRep.value = { ...cands, [mode]: null };

    try {
      appendMatchCsv(match, teamsPoolRep.value ?? null, weaponAliasesRep.value ?? null);
      log.info(`Match confirmed: ${match.id} (${mode}) -> data/matches.csv`);
    } catch (e) {
      log.error('Failed to append matches.csv', e);
    }

    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('dismissMatchCandidate', ({ mode }, ack) => {
    const cands = matchCandidatesRep.value;
    if (!cands) return;
    matchCandidatesRep.value = { ...cands, [mode]: null };
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

  nodecg.listenFor('generateWeaponAliasesCsv', (_data, ack) => {
    const result = generateWeaponAliasesCsv();
    log.info(
      `Generated data/weapon_aliases.csv: total=${result.total}, added=${result.added}`
    );
    weaponAliasesRep.value = loadWeaponAliasesFromCsv();
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

// 変数未使用を避けつつ、NonNullable<MatchCandidate> を参照として残す
export type _MatchCandidateRef = NonNullable<MatchCandidate>;
