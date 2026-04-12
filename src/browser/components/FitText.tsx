import { useRef, useEffect, useState, type HTMLAttributes } from 'react';

type Props = {
  /** レンダリングする生 HTML 文字列 */
  html: string;
  /** transform-origin の水平位置。左寄せなら 'left'、右寄せなら 'right' */
  align?: 'left' | 'right';
} & Omit<HTMLAttributes<HTMLDivElement>, 'dangerouslySetInnerHTML' | 'children'>;

/**
 * テキストが親の幅を超えたら自動で縮小して収める。
 * 内部で scrollWidth と clientWidth を比較し、
 * はみ出していれば transform: scale() で縮小する。
 */
export function FitText({ html, align = 'left', style, ...rest }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    // 一旦スケールをリセットして本来の幅を測る
    inner.style.transform = 'none';
    const contentWidth = inner.scrollWidth;
    const availableWidth = container.clientWidth;

    if (contentWidth > availableWidth && contentWidth > 0) {
      setScale(availableWidth / contentWidth);
    } else {
      setScale(1);
    }
  }, [html]);

  const origin = align === 'right' ? 'right top' : 'left top';

  return (
    <div ref={containerRef} style={{ ...style }} {...rest}>
      <span
        ref={innerRef}
        style={{
          display: 'inline-block',
          transform: `scale(${scale})`,
          transformOrigin: origin,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
