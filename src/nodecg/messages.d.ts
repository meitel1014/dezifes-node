import type { Team } from '../schemas';

export type Mode = 'turfWar' | 'splatZones';
export type Side = 'alpha' | 'bravo';
export type PickPosition = 0 | 1 | 2 | 3;

/**
 * すべてのメッセージの型を定義するマップ
 */
export type MessageMap = {
  /** data/teams.csv から teamsPool を再読み込み（編集内容は破棄される） */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ts-nodecg の規約：データなしメッセージは {} で表現
  reloadTeamsCsv: {};

  /** 指定モードの α/β 両方を非表示にし、選択も初期化する */
  resetMode: { data: { mode: Mode } };

  /** teamsPool 内の 1 チームを ID キーで部分更新する */
  updateTeam: { data: { mode: Mode; teamId: string; patch: Partial<Team> } };

  /** 判定結果候補の 1 マスを手動修正（playerName または weaponId を差し替え） */
  updateMatchCandidate: {
    data: {
      mode: Mode;
      candidateIndex: number;
      side: Side;
      position: PickPosition;
      patch: { playerName?: string; weaponId?: string };
    };
  };

  /** 判定結果を確定し matches に追加 + CSV 追記 + キューから指定インデックスのエントリを削除 */
  confirmMatchCandidate: { data: { mode: Mode; candidateIndex: number } };

  /** 判定結果候補を破棄（matches に記録せずキューから指定インデックスのエントリを削除） */
  dismissMatchCandidate: { data: { mode: Mode; candidateIndex: number } };

  /** matches から 1 件削除 */
  deleteMatch: { data: { id: string } };

  /** data/weapon_aliases.csv を再読込して weaponAliases Replicant に反映 */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- データなし
  reloadWeaponAliases: {};

  /** data/weapon_flat_10_0_0/ を走査して data/weapon_aliases.csv のひな型を生成 */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- データなし
  generateWeaponAliasesCsv: {};
};
