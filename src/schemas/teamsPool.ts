import { z } from 'zod';
import { teamSchema } from './team';

/**
 * モード別のチーム一覧。
 * 起動時に data/teams.csv からロードされ、Dashboard 編集時に上書きされる。
 * NodeCG Replicant の自動永続化（db/ 配下の JSON）に編集結果が保持されるため、
 * CSV 再読み込み時のみ原本から再ロードして編集内容を破棄する。
 */
export const teamsPoolSchema = z
  .object({
    turfWar: z.array(teamSchema).default([]),
    splatZones: z.array(teamSchema).default([]),
  })
  .default({ turfWar: [], splatZones: [] });

export type TeamsPool = z.infer<typeof teamsPoolSchema>;
