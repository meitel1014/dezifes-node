import type { HTMLAttributes } from 'react';

type Props = {
  /** レンダリングする生 HTML 文字列（CSV 由来の `<br>` 等を含みうる） */
  value: string;
  /** レンダリング先のタグ。デフォルトは span */
  as?: keyof HTMLElementTagNameMap;
} & Omit<HTMLAttributes<HTMLElement>, 'dangerouslySetInnerHTML' | 'children'>;

/**
 * 生 HTML を安全なスコープ内でレンダリングする専用コンポーネント。
 * dangerouslySetInnerHTML の使用をこのコンポーネントに閉じ込める。
 */
export function Html({ value, as: Tag = 'span', ...rest }: Props) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: value }} />;
}
