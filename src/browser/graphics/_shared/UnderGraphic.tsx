import { useFadeVisible } from '../../hooks/useFadeVisible';
import { stripHtml } from '../../utils/stripHtml';
import { useTeamData } from './useTeamData';
import { ShadowFilters } from './ShadowFilters';
import type { Mode, Side } from '@/nodecg/messages';

type Props = { mode: Mode };

const SHADOW = {
  color: 'rgb(43, 43, 43)',
  opacity: 0.7,
  dilate: 4,
  dx: 0,
  dy: 2,
  blur: 2,
} as const;

function TeamSlot({ mode, side }: { mode: Mode; side: Side }) {
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
      <ShadowFilters shadow={SHADOW} />
      <TeamSlot mode={mode} side="alpha" />
      <TeamSlot mode={mode} side="bravo" />
    </div>
  );
}
