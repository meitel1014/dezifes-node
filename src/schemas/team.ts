import { z } from 'zod';

/**
 * 1 チームの情報。
 * `id` は CSV 読み込み時に割り当てる不変の一意キー（選択・更新の参照に使う）。
 * `name` は画面表示用のチーム名で、Dashboard から自由に編集できる。
 * チーム名には `<br>` などの生 HTML を含みうる（プレビュー・Graphic で
 * `dangerouslySetInnerHTML` 経由でレンダリングされる前提）。
 */
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string(),
  players: z.tuple([z.string(), z.string(), z.string(), z.string()]),
});

export type Team = z.infer<typeof teamSchema>;
