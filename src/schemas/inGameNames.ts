import { z } from 'zod';

const inGameNamesSchema = z.record(z.string()).default({});

export { inGameNamesSchema };
export type InGameNames = z.infer<typeof inGameNamesSchema>;
