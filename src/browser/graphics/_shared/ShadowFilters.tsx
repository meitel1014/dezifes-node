type ShadowParams = {
  color: string;
  opacity: number;
  dilate: number;
  dx: number;
  dy: number;
  blur: number;
};

export function ShadowFilters({ shadow }: { shadow: ShadowParams }) {
  const sides = [
    { id: 'shadow-alpha', dx: -shadow.dx },
    { id: 'shadow-bravo', dx: shadow.dx },
  ];
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {sides.map(({ id, dx }) => (
          <filter key={id} id={id} x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor={shadow.color} floodOpacity={shadow.opacity} result="color" />
            <feMorphology in="SourceAlpha" operator="dilate" radius={shadow.dilate} result="spread" />
            <feOffset in="spread" dx={dx} dy={shadow.dy} result="shifted" />
            <feGaussianBlur in="shifted" stdDeviation={shadow.blur} result="blurred" />
            <feComposite in="color" in2="blurred" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
    </svg>
  );
}
