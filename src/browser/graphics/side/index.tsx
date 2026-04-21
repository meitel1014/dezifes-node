import '@/browser/global.css';
import '../_shared/side.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { SideGraphic } from '../_shared/SideGraphic';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (!activeMode) return null;
  return <SideGraphic mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
