import { useState } from 'react';

export type Status = 'idle' | 'loading' | 'done' | 'error';

type ReloadMessage = 'reloadTeamsCsv' | 'reloadInGameNamesCsv' | 'reloadWeaponAliases';

export function statusLabel(status: Status, idleLabel: string): string {
  if (status === 'loading') return '読み込み中…';
  if (status === 'done') return '完了';
  if (status === 'error') return '読み込み失敗';
  return idleLabel;
}

export function useReloadButton(message: ReloadMessage) {
  const [status, setStatus] = useState<Status>('idle');
  const handle = () => {
    setStatus('loading');
    void nodecg.sendMessage(message).then(
      () => { setStatus('done'); setTimeout(() => setStatus('idle'), 2000); },
      () => { setStatus('error'); setTimeout(() => setStatus('idle'), 3000); },
    );
  };
  return { status, handle };
}
