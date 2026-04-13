import type { Team } from '../schemas';

export type Mode = 'turfWar' | 'splatZones';
export type Side = 'alpha' | 'bravo';

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
};
