import { z } from 'zod';

export const googleSheetSyncSchema = z.boolean().default(false);
export type GoogleSheetSync = z.infer<typeof googleSheetSyncSchema>;

export const gasEndpointConfiguredSchema = z.boolean().default(false);
export type GasEndpointConfigured = z.infer<typeof gasEndpointConfiguredSchema>;
