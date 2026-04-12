import { Html } from '../../components/Html';
import { useFadeVisible } from '../../hooks/useFadeVisible';
import { useTeamData } from './useTeamData';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

function TeamSlot({ mode, side }: { mode: Mode; side: 'alpha' | 'bravo' }) {
  const { team, visible } = useTeamData(mode, side);
  const fadeStyle = useFadeVisible(visible);

  return (
    <div className={`under-slot under-${side}`} style={fadeStyle}>
      {team && (
        <>
          <Html value={team.name} as="div" className="under-team-name" />
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
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
