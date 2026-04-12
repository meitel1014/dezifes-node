import { z } from 'zod';

/**
 * 1 チームの情報。
 * チーム名には `<br>` などの生 HTML を含みうる（プレビュー・Graphic で
 * `dangerouslySetInnerHTML` 経由でレンダリングされる前提）。
 */
export const teamSchema = z.object({
  name: z.string(),
  alias: z.string(),
  players: z.tuple([z.string(), z.string(), z.string(), z.string()]),
});

export type Team = z.infer<typeof teamSchema>;
