import { z } from 'zod';

/**
 * 1 試合分のブキ編成ログ。確定操作で matches Replicant に追加される。
 * teamId は teamsPool 内のキー、weaponId は data/weapon_flat_10_0_0/ のファイル名
 * （拡張子なし）。日本語表示は weaponAliases を通して行い、ログ自体は不変 ID で保持する。
 */
const pickSchema = z.object({
  playerName: z.string(),
  weaponId: z.string(),
});

const sidePicksSchema = z.object({
  teamId: z.string(),
  picks: z.tuple([pickSchema, pickSchema, pickSchema, pickSchema]),
});

export const matchSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  mode: z.enum(['turfWar', 'splatZones']),
  sourceFile: z.string(),
  alpha: sidePicksSchema,
  bravo: sidePicksSchema,
  stageName: z.string().nullable().default(null),
});

export const matchesSchema = z.array(matchSchema).default([]);

export type Match = z.infer<typeof matchSchema>;
export type Matches = z.infer<typeof matchesSchema>;
