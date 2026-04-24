import { z } from 'zod';

const stageNamesSchema = z
  .object({
    turfWar: z.array(z.string()).default([]),
    splatZones: z.array(z.string()).default([]),
  })
  .default({ turfWar: [], splatZones: [] });

export { stageNamesSchema };
export type StageNames = z.infer<typeof stageNamesSchema>;
