import './ButtonsPanel.css';
import { useReplicant } from '../../hooks/useReplicant';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

export function ButtonsPanel({ mode }: Props) {
  const [visibility, setVisibility] = useReplicant('visibility');

  const vis = visibility?.[mode];

  const handleToggle = (side: 'alpha' | 'bravo') => {
    if (!visibility) return;
    setVisibility({
      ...visibility,
      [mode]: { ...visibility[mode], [side]: !visibility[mode][side] },
    });
  };

  const handleReset = () => {
    nodecg.sendMessage('resetMode', { mode });
  };

  return (
    <div className="buttons-panel">
      <button
        onClick={() => handleToggle('alpha')}
        className={`btn btn-alpha ${vis?.alpha ? 'active' : ''}`}
      >
        {vis?.alpha ? 'アルファチーム非表示' : 'アルファチーム表示'}
      </button>

      <button
        onClick={() => handleToggle('bravo')}
        className={`btn btn-bravo ${vis?.bravo ? 'active' : ''}`}
      >
        {vis?.bravo ? 'ブラボーチーム非表示' : 'ブラボーチーム表示'}
      </button>

      <button
        onClick={handleReset}
        className="btn btn-reset"
      >
        リセット
      </button>
    </div>
  );
}
