import { z } from 'zod';

export const MODE_VALUES = ['turfWar', 'splatZones'] as const;

export const activeModeSchema = z.enum(MODE_VALUES).default('turfWar');
export type ActiveMode = z.infer<typeof activeModeSchema>;
