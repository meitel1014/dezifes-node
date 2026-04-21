import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { TeamSelectPanel } from '../_shared/TeamSelectPanel';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return <TeamSelectPanel mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
