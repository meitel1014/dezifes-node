import { useState, useEffect } from 'react';
import { useReplicant } from '../../hooks/useReplicant';

export function ScreenshotDirPanel() {
  const [screenshotDir, setScreenshotDir] = useReplicant('screenshotDir');
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (screenshotDir !== undefined) setDraft(screenshotDir);
  }, [screenshotDir]);

  const handleSave = () => {
    setScreenshotDir(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = draft !== (screenshotDir ?? 'data/screenshots');

  return (
    <div className="csv-reload-panel">
      <p>
        スクショを自動取り込みするディレクトリを指定します。
        <br />
        絶対パスまたは NodeCG 起動ディレクトリからの相対パス。
      </p>
      <div className="field">
        <label>格納ディレクトリ</label>
        <input
          type="text"
          className="edit-input"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
          placeholder="data/screenshots"
          spellCheck={false}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={!isDirty || draft.trim() === ''}
        className="btn btn-reload"
      >
        {saved ? '保存しました' : '保存して適用'}
      </button>
    </div>
  );
}
