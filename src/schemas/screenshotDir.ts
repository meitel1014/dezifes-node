import { z } from 'zod';

export const screenshotDirSchema = z.string().default('data/screenshots');
export type ScreenshotDir = z.infer<typeof screenshotDirSchema>;
