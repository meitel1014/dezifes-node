import { z } from 'zod';

/**
 * OCR 直後・未確定のスクショ判定結果。
 * モード別に最大 10 件のキューとして保持し、確定 or 破棄で個別に削除される。
 * playerCandidates / weaponCandidates はスコア降順で並んだ候補リスト、
 * selected は現在ドロップダウンで選ばれている値。
 */
const pickCandidateSchema = z.object({
  position: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  playerCandidates: z.array(z.string()),
  weaponCandidates: z.array(z.string()),
  selected: z.object({
    playerName: z.string(),
    weaponId: z.string(),
  }),
  nameImageDataUrl: z.string().optional(),
  nameCompareDataUrl: z.string().optional(),
  weaponImageDataUrl: z.string().optional(),
});

const sideCandidateSchema = z.object({
  teamId: z.string(),
  picks: z.tuple([
    pickCandidateSchema,
    pickCandidateSchema,
    pickCandidateSchema,
    pickCandidateSchema,
  ]),
});

const matchCandidateSchema = z.object({
  sourceFile: z.string(),
  annotatedFile: z.string().optional(),
  createdAt: z.string(),
  alpha: sideCandidateSchema,
  bravo: sideCandidateSchema,
  wonSide: z.enum(['alpha', 'bravo']).nullable().default(null),
  stageName: z.string().nullable().default(null),
  stageScore: z.number().nullable().default(null),
  stageScores: z.array(z.object({ stageName: z.string(), score: z.number() })).default([]),
});

export const matchCandidatesSchema = z
  .object({
    turfWar: z.array(matchCandidateSchema).default([]),
    splatZones: z.array(matchCandidateSchema).default([]),
  })
  .default({ turfWar: [], splatZones: [] });

export type MatchCandidate = z.infer<typeof matchCandidateSchema>;
export type MatchCandidates = z.infer<typeof matchCandidatesSchema>;
export type PickCandidate = z.infer<typeof pickCandidateSchema>;
