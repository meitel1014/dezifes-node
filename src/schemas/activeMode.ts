import { z } from 'zod';

export const activeModeSchema = z.enum(['turfWar', 'splatZones']).default('turfWar');
export type ActiveMode = z.infer<typeof activeModeSchema>;
