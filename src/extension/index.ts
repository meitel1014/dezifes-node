import type { NodeCG } from './nodecg';
import { loadTeamsPoolFromCsv } from './loadTeams';

export default (nodecg: NodeCG) => {
  const log = new nodecg.Logger('dezifes');
  log.info('=====Extension is running=====');

  // Replicant 取得（Zod スキーマの .default() により初期構造は自動適用される）
  const teamsPoolRep = nodecg.Replicant('teamsPool');
  const selectionRep = nodecg.Replicant('selection');
  const visibilityRep = nodecg.Replicant('visibility');

  // 初回起動時のみ CSV から teamsPool を初期化。
  // NodeCG の永続化により 2 回目以降は前回の編集内容が復元されるため、
  // 「初回起動 = 空配列しか入っていない」状態を検出して CSV ロードを行う。
  const isEmptyPool = (pool: typeof teamsPoolRep.value) =>
    !pool || (pool.turfWar.length === 0 && pool.splatZones.length === 0);

  if (isEmptyPool(teamsPoolRep.value)) {
    const loaded = loadTeamsPoolFromCsv();
    teamsPoolRep.value = loaded;
    log.info(
      `Loaded teams from CSV: turfWar=${loaded.turfWar.length}, splatZones=${loaded.splatZones.length}`
    );
  }

  // CSV 再読込：teamsPool を原本から強制上書き（＝編集内容は破棄）
  nodecg.listenFor('reloadTeamsCsv', () => {
    const loaded = loadTeamsPoolFromCsv();
    teamsPoolRep.value = loaded;
    log.info(
      `Reloaded teams from CSV: turfWar=${loaded.turfWar.length}, splatZones=${loaded.splatZones.length}`
    );
  });

  // 指定モード・サイドをフェードインで表示
  nodecg.listenFor('showTeam', ({ mode, side }) => {
    const current = visibilityRep.value ?? {
      turfWar: { alpha: false, bravo: false },
      splatZones: { alpha: false, bravo: false },
    };
    visibilityRep.value = {
      ...current,
      [mode]: { ...current[mode], [side]: true },
    };
  });

  // モード単位のリセット：α/β 両方を非表示化し、選択もクリア
  nodecg.listenFor('resetMode', ({ mode }) => {
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
  });

  // チーム情報の部分更新（teamName をキーに同モード内の 1 チームを書き換え）
  // チーム名自体をリネームした場合、selection 側の参照もカスケード更新する。
  nodecg.listenFor('updateTeam', ({ mode, teamName, patch }) => {
    const pool = teamsPoolRep.value;
    if (!pool) return;
    const list = pool[mode];
    const idx = list.findIndex((t) => t.name === teamName);
    if (idx < 0) return;

    const prev = list[idx];
    const updated = { ...prev, ...patch };
    // players のタプル型を保持するため、明示的に再構築
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

    // リネーム時は selection の参照も追従する
    if (patch.name && patch.name !== prev.name) {
      const sel = selectionRep.value;
      if (sel) {
        const slot = sel[mode];
        const newSlot = {
          alpha: slot.alpha === prev.name ? patch.name : slot.alpha,
          bravo: slot.bravo === prev.name ? patch.name : slot.bravo,
        };
        selectionRep.value = { ...sel, [mode]: newSlot };
      }
    }
  });
};;
