import '@/browser/global.css';
import '../_shared/dashboard.css';
import './mode-select.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';

function App() {
  const [activeMode, setActiveMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return (
    <div className="mode-select-panel">
      <div className="mode-select-label">ルール</div>
      <div className="mode-select-buttons">
        <button
          className={`mode-select-btn mode-select-btn--turf-war${activeMode === 'turfWar' ? ' active' : ''}`}
          onClick={() => setActiveMode('turfWar')}
        >
          ナワバリ
        </button>
        <button
          className={`mode-select-btn mode-select-btn--splat-zones${activeMode === 'splatZones' ? ' active' : ''}`}
          onClick={() => setActiveMode('splatZones')}
        >
          エリア
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
