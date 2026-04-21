import { useReplicant } from '@/browser/hooks/useReplicant';

export function GoogleSheetSyncPanel() {
  const [syncEnabled, setSyncEnabled] = useReplicant('googleSheetSync');
  const [gasConfigured] = useReplicant('gasEndpointConfigured');

  return (
    <div className="google-sheet-panel">
      <div className="toggle-row">
        <span className="toggle-label">Google スプレッドシート同期</span>
        <button
          className={`toggle-btn ${syncEnabled ? 'toggle-btn--on' : ''}`}
          onClick={() => setSyncEnabled(!syncEnabled)}
          disabled={syncEnabled === undefined}
        >
          {syncEnabled ? 'ON（CSV + Sheets）' : 'OFF（CSV のみ）'}
        </button>
      </div>
      <p className={`gas-status ${gasConfigured ? 'gas-status--ok' : 'gas-status--ng'}`}>
        GAS エンドポイント:{' '}
        <strong>{gasConfigured ? '設定済み' : '未設定（.env に GAS_ENDPOINT_URL を追加）'}</strong>
      </p>
      {syncEnabled && !gasConfigured && (
        <p className="gas-warning">
          ⚠ ON になっていますが GAS_ENDPOINT_URL が未設定のため同期されません。
        </p>
      )}
    </div>
  );
}
