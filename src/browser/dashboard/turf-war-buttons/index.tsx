import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { ButtonsPanel } from '../_shared/ButtonsPanel';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return <ButtonsPanel mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
