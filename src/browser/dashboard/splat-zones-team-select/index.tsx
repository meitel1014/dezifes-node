import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { TeamSelectPanel } from '../_shared/TeamSelectPanel';

createRoot(document.getElementById('root')!).render(
  <TeamSelectPanel mode="splatZones" />
);
