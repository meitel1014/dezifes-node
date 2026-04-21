import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { ResultsPanel } from '../_shared/ResultsPanel';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return <ResultsPanel mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
