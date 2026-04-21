import '@/browser/global.css';
import '../_shared/under.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { UnderGraphic } from '../_shared/UnderGraphic';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (!activeMode) return null;
  return <UnderGraphic mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
