import { useState } from 'react';

export function CsvReloadPanel() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleReload = () => {
    setStatus('loading');
    void nodecg.sendMessage('reloadTeamsCsv').then(() => {
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    });
  };

  return (
    <div className="csv-reload-panel">
      <p>
        <code>data/teams.csv</code> からチーム情報を再読み込みします。
        <br />
        編集内容はすべて破棄されます。
      </p>
      <button
        onClick={handleReload}
        disabled={status === 'loading'}
        className="btn btn-reload"
      >
        {status === 'loading' ? '読み込み中…' : status === 'done' ? '完了' : 'CSV 再読込'}
      </button>
    </div>
  );
}
