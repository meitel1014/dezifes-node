import '@/browser/global.css';
import '../_shared/under.css';
import { createRoot } from 'react-dom/client';
import { UnderGraphic } from '../_shared/UnderGraphic';

createRoot(document.getElementById('root')!).render(
  <UnderGraphic mode="turfWar" />
);
