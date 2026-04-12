import '@/browser/global.css';
import '../_shared/dashboard.css';
import { createRoot } from 'react-dom/client';
import { PreviewEditPanel } from '../_shared/PreviewEditPanel';

createRoot(document.getElementById('root')!).render(
  <PreviewEditPanel mode="turfWar" />
);
