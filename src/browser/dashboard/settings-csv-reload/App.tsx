import { statusLabel, useReloadButton } from '../_shared/useReloadButton';

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
