import { z } from 'zod';

/**
 * 各モードで α / β に選択されたチーム ID（null は未選択）。
 * ID は TeamsPool 内で一意のキーとして扱う。
 */
const slotSchema = z
  .object({
    alpha: z.string().nullable().default(null),
    bravo: z.string().nullable().default(null),
  })
  .default({ alpha: null, bravo: null });

export const selectionSchema = z
  .object({
    turfWar: slotSchema,
    splatZones: slotSchema,
  })
  .default({
    turfWar: { alpha: null, bravo: null },
    splatZones: { alpha: null, bravo: null },
  });

export type Selection = z.infer<typeof selectionSchema>;
