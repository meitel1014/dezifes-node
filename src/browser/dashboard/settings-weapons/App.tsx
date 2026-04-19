import { useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function WeaponsSettingsPanel() {
  const [aliases] = useReplicant('weaponAliases');
  const [genStatus, setGenStatus] = useState<Status>('idle');
  const [reloadStatus, setReloadStatus] = useState<Status>('idle');

  const total = Object.keys(aliases ?? {}).length;

  const handleGenerate = () => {
    setGenStatus('loading');
    void nodecg.sendMessage('generateWeaponAliasesCsv').then(
      () => {
        setGenStatus('done');
        setTimeout(() => setGenStatus('idle'), 2000);
      },
      () => {
        setGenStatus('error');
        setTimeout(() => setGenStatus('idle'), 3000);
      }
    );
  };

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
        onClick={handleGenerate}
        disabled={genStatus === 'loading'}
        className="btn btn-reload"
      >
        {genStatus === 'loading'
          ? '生成中…'
          : genStatus === 'done'
            ? '生成完了'
            : genStatus === 'error'
              ? '失敗'
              : '対応表CSVを生成（既存 ja は保持）'}
      </button>
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
