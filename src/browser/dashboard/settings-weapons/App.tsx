import { useReplicant } from '../../hooks/useReplicant';
import { statusLabel, useReloadButton } from '../_shared/useReloadButton';

export function WeaponsSettingsPanel() {
  const [aliases] = useReplicant('weaponAliases');
  const reload = useReloadButton('reloadWeaponAliases');

  const total = Object.keys(aliases ?? {}).length;

  return (
    <div className="csv-reload-panel">
      <p>
        ブキ名対応表 <code>data/weapon_aliases.csv</code>（<code>id,ja</code>）の管理。
        <br />
        現在の登録数: <strong>{total}</strong> 件
      </p>
      <button
        onClick={reload.handle}
        disabled={reload.status === 'loading'}
        className="btn btn-reload"
      >
        {statusLabel(reload.status, '対応表CSVを再読込')}
      </button>
    </div>
  );
}
