import '@/browser/global.css';
import '../_shared/side.css';
import { createRoot } from 'react-dom/client';
import { SideGraphic } from '../_shared/SideGraphic';

createRoot(document.getElementById('root')!).render(
  <SideGraphic mode="splatZones" />
);
