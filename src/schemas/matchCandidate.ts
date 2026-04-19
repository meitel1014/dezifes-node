import { z } from 'zod';

/**
 * OCR 直後・未確定のスクショ判定結果。
 * モード別に最新 1 件のみ保持し、確定 or 破棄で null に戻る。
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

const candidateSchema = z
  .object({
    sourceFile: z.string(),
    annotatedFile: z.string().optional(),
    createdAt: z.string(),
    alpha: sideCandidateSchema,
    bravo: sideCandidateSchema,
  })
  .nullable();

export const matchCandidatesSchema = z
  .object({
    turfWar: candidateSchema.default(null),
    splatZones: candidateSchema.default(null),
  })
  .default({ turfWar: null, splatZones: null });

export type MatchCandidate = z.infer<typeof candidateSchema>;
export type MatchCandidates = z.infer<typeof matchCandidatesSchema>;
export type PickCandidate = z.infer<typeof pickCandidateSchema>;
