import { useFadeVisible } from '../../hooks/useFadeVisible';
import { stripHtml } from '../../utils/stripHtml';
import { useTeamData } from './useTeamData';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

const SHADOW = {
  color: 'rgb(43, 43, 43)',
  opacity: 0.7,
  dilate: 4,
  dx: 0,
  dy: 2,
  blur: 2,
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

  return (
    <div className={`under-slot under-${side}`} style={fadeStyle}>
      {team && (
        <>
          <div className="under-team-name">{stripHtml(team.name)}</div>
          <div className="under-players">
            {team.players.join('\u3000')}
          </div>
        </>
      )}
    </div>
  );
}

export function UnderGraphic({ mode }: Props) {
  return (
    <div className="under-container">
      <ShadowFilters />
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
