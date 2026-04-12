import '@/browser/global.css';
import { createRoot } from 'react-dom/client';
import { PreviewEditPanel } from '../_shared/PreviewEditPanel';

createRoot(document.getElementById('root')!).render(
  <PreviewEditPanel mode="turfWar" />
);
