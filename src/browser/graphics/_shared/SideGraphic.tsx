import { Html } from '../../components/Html';
import { FitText } from '../../components/FitText';
import { useFadeVisible } from '../../hooks/useFadeVisible';
import { useTeamData } from './useTeamData';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

const SHADOW = {
  color: 'rgb(94, 94, 94)',
  opacity: 0.6,
  dilate: 6,
  dx: 6,
  dy: 10,
  blur: 4,
} as const;

function ShadowFilters() {
  const sides = [
    { id: 'shadow-alpha', dx: -SHADOW.dx },
    { id: 'shadow-bravo', dx: SHADOW.dx },
  ];
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {sides.map(({ id, dx }) => (
          <filter key={id} id={id} x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor={SHADOW.color} floodOpacity={SHADOW.opacity} result="color" />
            <feMorphology in="SourceAlpha" operator="dilate" radius={SHADOW.dilate} result="spread" />
            <feOffset in="spread" dx={dx} dy={SHADOW.dy} result="shifted" />
            <feGaussianBlur in="shifted" stdDeviation={SHADOW.blur} result="blurred" />
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

function TeamSlot({ mode, side }: { mode: Mode; side: 'alpha' | 'bravo' }) {
  const { team, visible } = useTeamData(mode, side);
  const fadeStyle = useFadeVisible(visible);
  const align = side === 'alpha' ? 'left' : 'right';

  return (
    <div className={`side-slot side-${side}`} style={fadeStyle}>
      {team && (
        <div className="side-team-content">
          <Html value={team.alias} as="div" className="side-alias" />
          <FitText
            html={team.name}
            align={align}
            className="side-team-name"
          />
          <div className="side-players">
            {team.players.map((p, i) => (
              <div key={i} className="side-player">{p}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SideGraphic({ mode }: Props) {
  return (
    <div className="side-container">
      <ShadowFilters />
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
