import { z } from 'zod';

export const inGameNamesSchema = z.record(z.string(), z.string()).default({});
export type InGameNames = z.infer<typeof inGameNamesSchema>;
