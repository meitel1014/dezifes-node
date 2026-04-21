import '@/browser/global.css';
import '../_shared/dashboard.css';
import './mode-toggle.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { ButtonsPanel } from '../_shared/ButtonsPanel';

function App() {
  const [activeMode, setActiveMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return (
    <div className="mode-buttons-wrapper">
      <div className="mode-toggle-bar">
        <button
          className={`mode-toggle-btn mode-toggle-btn--turf-war${activeMode === 'turfWar' ? ' active' : ''}`}
          onClick={() => setActiveMode('turfWar')}
        >
          ナワバリ
        </button>
        <button
          className={`mode-toggle-btn mode-toggle-btn--splat-zones${activeMode === 'splatZones' ? ' active' : ''}`}
          onClick={() => setActiveMode('splatZones')}
        >
          エリア
        </button>
      </div>
      <ButtonsPanel mode={activeMode} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
