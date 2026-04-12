import { useEffect, useState } from 'react';

/**
 * visibility の boolean に応じて、0.5 秒のフェードイン / フェードアウトを
 * CSS transition で実現するためのスタイルを返すフック。
 *
 * - visible=true  → opacity:1（フェードイン）
 * - visible=false → opacity:0（フェードアウト）
 *
 * 初回マウント時のフラッシュを防ぐため、マウント後に visible を反映する。
 */
export function useFadeVisible(visible: boolean) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 次フレームで mounted を true にし、初回アニメーションを有効化
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const style = {
    opacity: mounted && visible ? 1 : 0,
    transition: 'opacity 0.5s ease',
  } as const;

  return style;
}
