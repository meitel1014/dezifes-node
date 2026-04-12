import '@/browser/global.css';
import { createRoot } from 'react-dom/client';
import { ButtonsPanel } from '../_shared/ButtonsPanel';

createRoot(document.getElementById('root')!).render(
  <ButtonsPanel mode="splatZones" />
);
