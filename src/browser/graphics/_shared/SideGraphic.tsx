import { Html } from '../../components/Html';
import { FitText } from '../../components/FitText';
import { useFadeVisible } from '../../hooks/useFadeVisible';
import { useTeamData } from './useTeamData';
import { ShadowFilters } from './ShadowFilters';
import type { Mode, Side } from '@/nodecg/messages';

type Props = { mode: Mode };

const SHADOW = {
  color: 'rgb(94, 94, 94)',
  opacity: 0.6,
  dilate: 6,
  dx: 6,
  dy: 10,
  blur: 4,
} as const;

function TeamSlot({ mode, side }: { mode: Mode; side: Side }) {
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
      <ShadowFilters shadow={SHADOW} />
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
