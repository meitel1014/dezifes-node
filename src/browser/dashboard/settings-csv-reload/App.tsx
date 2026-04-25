import { useState } from 'react';

type Status = 'idle' | 'loading' | 'done' | 'error';

function statusLabel(status: Status, idleLabel: string): string {
  if (status === 'loading') return '読み込み中…';
  if (status === 'done') return '完了';
  if (status === 'error') return '読み込み失敗';
  return idleLabel;
}

function useReloadButton(message: 'reloadTeamsCsv' | 'reloadInGameNamesCsv') {
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

export function CsvReloadPanel() {
  const teams = useReloadButton('reloadTeamsCsv');
  const inGame = useReloadButton('reloadInGameNamesCsv');

  return (
    <div className="csv-reload-panel">
      <p>
        <code>data/teams.csv</code> からチーム情報を再読み込みします。
        <br />
        編集内容はすべて破棄されます。
      </p>
      <button
        onClick={teams.handle}
        disabled={teams.status === 'loading'}
        className="btn btn-reload"
      >
        {statusLabel(teams.status, 'チーム情報CSV再読込')}
      </button>

      <p style={{ marginTop: '16px' }}>
        <code>data/in-game-name.csv</code> からゲーム内名前対応表を再読み込みします。
      </p>
      <button
        onClick={inGame.handle}
        disabled={inGame.status === 'loading'}
        className="btn btn-reload"
      >
        {statusLabel(inGame.status, 'ゲーム内表記CSV再読込')}
      </button>
    </div>
  );
}
