import { useReplicant } from '../../hooks/useReplicant';
import { stripHtml } from '../../utils/stripHtml';
import type { Mode } from '@/nodecg/messages';

type Props = { mode: Mode };

export function TeamSelectPanel({ mode }: Props) {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection, setSelection] = useReplicant('selection');

  if (!teamsPool || !selection) return <p>読み込み中…</p>;

  const teams = teamsPool[mode];
  const slot = selection[mode];

  const handleChange = (side: 'alpha' | 'bravo', teamId: string) => {
    setSelection({
      ...selection,
      [mode]: { ...slot, [side]: teamId || null },
    });
  };

  return (
    <div className="team-select-panel">
      <div className="field field-alpha">
        <label>アルファチーム</label>
        <select
          value={slot.alpha ?? ''}
          onChange={(e) => handleChange('alpha', e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {stripHtml(t.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="field field-bravo">
        <label>ブラボーチーム</label>
        <select
          value={slot.bravo ?? ''}
          onChange={(e) => handleChange('bravo', e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {stripHtml(t.name)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
