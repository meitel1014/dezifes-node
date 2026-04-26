import '@/browser/global.css';
import './champions.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { useFadeVisible } from '@/browser/hooks/useFadeVisible';
import { FitText } from '@/browser/components/FitText';
import { useTeamData } from '../_shared/useTeamData';
import type { Mode, Side } from '@/nodecg/messages';

function TeamNames({ mode }: { mode: Mode }) {
  const alpha = useTeamData(mode, 'alpha');
  const bravo = useTeamData(mode, 'bravo');
  const alphaFade = useFadeVisible(alpha.visible);
  const bravoFade = useFadeVisible(bravo.visible);

  return (
    <div className="champ-team-names">
      <div className="champ-team-name-wrapper team-alpha" style={alphaFade}>
        <FitText
          html={alpha.team?.name ?? ''}
          align="left"
          className="champ-team-name"
        />
      </div>
      <div className="champ-team-name-wrapper team-bravo" style={bravoFade}>
        <FitText
          html={bravo.team?.name ?? ''}
          align="left"
          className="champ-team-name"
        />
      </div>
    </div>
  );
}

function PlayersColumn({ mode, side }: { mode: Mode; side: Side }) {
  const { team, visible } = useTeamData(mode, side);
  const fadeStyle = useFadeVisible(visible);
  const className = side === 'alpha' ? 'champ-alpha-players' : 'champ-bravo-players';

  return (
    <div className={className} style={fadeStyle}>
      {team?.players.map((p, i) => (
        <div key={i} className="champ-player">{p}</div>
      ))}
    </div>
  );
}

function ChampionsGraphic({ mode }: { mode: Mode }) {
  return (
    <div className="champ-container">
      <TeamNames mode={mode} />
      <PlayersColumn mode={mode} side="alpha" />
      <PlayersColumn mode={mode} side="bravo" />
    </div>
  );
}

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (!activeMode) return null;
  return <ChampionsGraphic mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
