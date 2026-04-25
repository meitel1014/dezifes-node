import { z } from 'zod';

// NodeCG の configschema 用。このバンドルは cfg/ による設定項目を持たないため空。
export const bundleConfigSchema = z.object({});

export type BundleConfig = z.infer<typeof bundleConfigSchema>;
