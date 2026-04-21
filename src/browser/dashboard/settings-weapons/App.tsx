import { useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function WeaponsSettingsPanel() {
  const [aliases] = useReplicant('weaponAliases');
  const [reloadStatus, setReloadStatus] = useState<Status>('idle');

  const total = Object.keys(aliases ?? {}).length;

  const handleReload = () => {
    setReloadStatus('loading');
    void nodecg.sendMessage('reloadWeaponAliases').then(
      () => {
        setReloadStatus('done');
        setTimeout(() => setReloadStatus('idle'), 2000);
      },
      () => {
        setReloadStatus('error');
        setTimeout(() => setReloadStatus('idle'), 3000);
      }
    );
  };

  return (
    <div className="csv-reload-panel">
      <p>
        ブキ名対応表 <code>data/weapon_aliases.csv</code>（<code>id,ja</code>）の管理。
        <br />
        現在の登録数: <strong>{total}</strong> 件
      </p>
      <button
        onClick={handleReload}
        disabled={reloadStatus === 'loading'}
        className="btn btn-reload"
      >
        {reloadStatus === 'loading'
          ? '読み込み中…'
          : reloadStatus === 'done'
            ? '完了'
            : reloadStatus === 'error'
              ? '失敗'
              : '対応表CSVを再読込'}
      </button>
    </div>
  );
}
