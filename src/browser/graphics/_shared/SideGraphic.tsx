import { Html } from '../../components/Html';
import { useFadeVisible } from '../../hooks/useFadeVisible';
import { useTeamData } from './useTeamData';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

function TeamSlot({ mode, side }: { mode: Mode; side: 'alpha' | 'bravo' }) {
  const { team, visible } = useTeamData(mode, side);
  const fadeStyle = useFadeVisible(visible);

  return (
    <div className={`side-slot side-${side}`} style={fadeStyle}>
      {team && (
        <div className="side-team-content">
          <div className="side-alias">{team.alias}</div>
          <Html value={team.name} as="div" className="side-team-name" />
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
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
