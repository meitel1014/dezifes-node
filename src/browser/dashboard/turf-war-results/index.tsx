import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { ResultsPanel } from '../_shared/ResultsPanel';

createRoot(document.getElementById('root')!).render(
  <ResultsPanel mode="turfWar" />
);
