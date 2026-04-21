import { z } from 'zod';

/**
 * 各モードの アルファ / ブラボー の表示状態。true でフェードイン表示、false で非表示。
 */
const sideVisibilitySchema = z
  .object({
    alpha: z.boolean().default(false),
    bravo: z.boolean().default(false),
  })
  .default({ alpha: false, bravo: false });

export const visibilitySchema = z
  .object({
    turfWar: sideVisibilitySchema,
    splatZones: sideVisibilitySchema,
  })
  .default({
    turfWar: { alpha: false, bravo: false },
    splatZones: { alpha: false, bravo: false },
  });

export type Visibility = z.infer<typeof visibilitySchema>;
