import { z } from 'zod';

export const bundleConfigSchema = z.object({
  screenshotDir: z.string().default('data/screenshots'),
});

export type BundleConfig = z.infer<typeof bundleConfigSchema>;
