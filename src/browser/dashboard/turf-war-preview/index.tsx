import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { PreviewEditPanel } from '../_shared/PreviewEditPanel';

function App() {
  const [activeMode] = useReplicant('activeMode');
  if (activeMode === undefined) return null;
  return <PreviewEditPanel mode={activeMode} />;
}

createRoot(document.getElementById('root')!).render(<App />);
