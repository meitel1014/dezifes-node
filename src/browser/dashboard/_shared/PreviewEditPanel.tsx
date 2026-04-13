import { useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';
import { Html } from '../../components/Html';
import type { Mode } from '@/nodecg/messages';
import type { Team } from '@/schemas';

type Props = { mode: Mode };

/** 編集対象のフィールドと現在値 */
type EditTarget = {
  side: 'alpha' | 'bravo';
  field: 'name' | 'alias' | 'player0' | 'player1' | 'player2' | 'player3';
  value: string;
};

function getFieldValue(team: Team, field: EditTarget['field']): string {
  if (field === 'name') return team.name;
  if (field === 'alias') return team.alias;
  const idx = parseInt(field.replace('player', ''));
  return team.players[idx];
}

function buildPatch(team: Team, field: EditTarget['field'], value: string): Partial<Team> {
  if (field === 'name') return { name: value };
  if (field === 'alias') return { alias: value };
  const idx = parseInt(field.replace('player', ''));
  const players: [string, string, string, string] = [...team.players];
  players[idx] = value;
  return { players };
}

export function PreviewEditPanel({ mode }: Props) {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection] = useReplicant('selection');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  if (!teamsPool || !selection) return <p>読み込み中…</p>;

  const slot = selection[mode];
  const teams = teamsPool[mode];

  const findTeam = (id: string | null) =>
    id ? teams.find((t) => t.id === id) ?? null : null;

  const alphaTeam = findTeam(slot.alpha);
  const bravoTeam = findTeam(slot.bravo);

  const startEdit = (side: 'alpha' | 'bravo', field: EditTarget['field'], team: Team) => {
    setEditTarget({ side, field, value: getFieldValue(team, field) });
  };

  const cancelEdit = () => setEditTarget(null);

  const saveEdit = () => {
    if (!editTarget) return;
    const team = editTarget.side === 'alpha' ? alphaTeam : bravoTeam;
    if (!team) return;

    const patch = buildPatch(team, editTarget.field, editTarget.value);
    nodecg.sendMessage('updateTeam', {
      mode,
      teamId: team.id,
      patch,
    });
    setEditTarget(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const renderTeamPreview = (side: 'alpha' | 'bravo', team: Team | null) => {
    if (!team) {
      return (
        <div className={`preview-column preview-${side}`}>
          <h3>{side === 'alpha' ? 'アルファ' : 'ブラボー'}</h3>
          <p className="preview-empty">未選択</p>
        </div>
      );
    }

    type FieldDef = { field: EditTarget['field']; label: string };
    const fields: FieldDef[] = [
      { field: 'alias', label: '二つ名' },
      { field: 'name', label: 'チーム名' },
      { field: 'player0', label: 'プレイヤー1' },
      { field: 'player1', label: 'プレイヤー2' },
      { field: 'player2', label: 'プレイヤー3' },
      { field: 'player3', label: 'プレイヤー4' },
    ];

    return (
      <div className={`preview-column preview-${side}`}>
        <h3>{side === 'alpha' ? 'アルファ' : 'ブラボー'}</h3>
        <table className="preview-table">
          <tbody>
            {fields.map(({ field, label }) => {
              const isEditing =
                editTarget?.side === side && editTarget?.field === field;
              const displayValue = getFieldValue(team, field);

              return (
                <tr key={field}>
                  <th>{label}</th>
                  <td>
                    {isEditing ? (
                      <input
                        className="edit-input"
                        value={editTarget.value}
                        onChange={(e) =>
                          setEditTarget({ ...editTarget, value: e.target.value })
                        }
                        onKeyDown={handleKeyDown}
                        autoFocus
                      />
                    ) : (
                      <Html value={displayValue} as="span" className="field-value" />
                    )}
                  </td>
                  <td className="action-cell">
                    {isEditing ? (
                      <>
                        <button className="btn-sm btn-save" onClick={saveEdit}>
                          保存
                        </button>
                        <button className="btn-sm btn-cancel" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-sm btn-edit"
                        onClick={() => startEdit(side, field, team)}
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="preview-edit-panel">
      {renderTeamPreview('alpha', alphaTeam)}
      {renderTeamPreview('bravo', bravoTeam)}
    </div>
  );
}
