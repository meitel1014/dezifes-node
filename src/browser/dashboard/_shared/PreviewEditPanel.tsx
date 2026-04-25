import './PreviewEditPanel.css';
import { Fragment, useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';
import { Html } from '../../components/Html';
import { stripHtml } from '../../utils/stripHtml';
import type { Mode, Side } from '@/nodecg/messages';
import type { Team } from '@/schemas';

type Props = { mode: Mode };

/** チーム情報（alias / name）の編集対象 */
type EditTarget = {
  side: Side;
  field: 'name' | 'alias';
  value: string;
};

/** ゲーム内名前の編集対象 */
type EditInGameTarget = {
  playerName: string;
  value: string;
};

function getFieldValue(team: Team, field: EditTarget['field']): string {
  if (field === 'name') return team.name;
  return team.alias;
}

function buildPatch(field: EditTarget['field'], value: string): Partial<Team> {
  if (field === 'name') return { name: value };
  return { alias: value };
}

const PLAYER_LABELS = ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4'] as const;

export function PreviewEditPanel({ mode }: Props) {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection] = useReplicant('selection');
  const [inGameNames] = useReplicant('inGameNames');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editInGame, setEditInGame] = useState<EditInGameTarget | null>(null);

  if (!teamsPool || !selection) return <p>読み込み中…</p>;

  const slot = selection[mode];
  const teams = teamsPool[mode];

  const findTeam = (id: string | null) =>
    id ? teams.find((t) => t.id === id) ?? null : null;

  const alphaTeam = findTeam(slot.alpha);
  const bravoTeam = findTeam(slot.bravo);

  // ── チーム情報（alias / name）の編集 ──
  const startEdit = (side: Side, field: EditTarget['field'], team: Team) => {
    setEditInGame(null);
    setEditTarget({ side, field, value: getFieldValue(team, field) });
  };
  const cancelEdit = () => setEditTarget(null);
  const saveEdit = () => {
    if (!editTarget) return;
    const team = editTarget.side === 'alpha' ? alphaTeam : bravoTeam;
    if (!team) return;
    void nodecg.sendMessage('updateTeam', {
      mode,
      teamId: team.id,
      patch: buildPatch(editTarget.field, editTarget.value),
    });
    setEditTarget(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  // ── ゲーム内名前の編集 ──
  const startInGameEdit = (playerName: string, currentInGame: string) => {
    setEditTarget(null);
    setEditInGame({ playerName, value: currentInGame });
  };
  const cancelInGameEdit = () => setEditInGame(null);
  const saveInGameEdit = () => {
    if (!editInGame) return;
    void nodecg.sendMessage('setInGameName', {
      playerName: editInGame.playerName,
      inGameName: editInGame.value,
    });
    setEditInGame(null);
  };
  const handleInGameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveInGameEdit();
    if (e.key === 'Escape') cancelInGameEdit();
  };

  const renderTeamPreview = (side: Side, team: Team | null) => {
    if (!team) {
      return (
        <div className={`preview-column preview-${side}`}>
          <h3>{side === 'alpha' ? 'アルファ' : 'ブラボー'}</h3>
          <p className="preview-empty">未選択</p>
        </div>
      );
    }

    const teamFields: { field: EditTarget['field']; label: string }[] = [
      { field: 'alias', label: '二つ名' },
      { field: 'name', label: 'チーム名 (左右用)' },
    ];

    return (
      <div className={`preview-column preview-${side}`}>
        <h3>{side === 'alpha' ? 'アルファ' : 'ブラボー'} | {team.id}</h3>
        <table className="preview-table">
          <tbody>
            {/* 二つ名・チーム名（編集可） */}
            {teamFields.map(({ field, label }) => {
              const isEditing = editTarget?.side === side && editTarget?.field === field;
              const displayValue = getFieldValue(team, field);
              return (
                <tr key={field}>
                  <th>{label}</th>
                  <td>
                    {isEditing ? (
                      <input
                        className="edit-input"
                        value={editTarget.value}
                        onChange={(e) => setEditTarget({ ...editTarget, value: e.target.value })}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      />
                    ) : field === 'name' ? (
                      <span className="field-value">{displayValue}</span>
                    ) : (
                      <Html value={displayValue} as="span" className="field-value" />
                    )}
                  </td>
                  <td className="action-cell">
                    {isEditing ? (
                      <>
                        <button className="btn-sm btn-save" onClick={saveEdit}>保存</button>
                        <button className="btn-sm btn-cancel" onClick={cancelEdit}>取消</button>
                      </>
                    ) : (
                      <button className="btn-sm btn-edit" onClick={() => startEdit(side, field, team)}>
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* プレイヤー名（読み取り専用） + ゲーム内名前（編集可） */}
            {team.players.map((playerName, idx) => {
              const currentInGame = inGameNames?.[playerName] ?? playerName;
              const isEditingInGame = editInGame?.playerName === playerName;
              const isDifferent = currentInGame !== playerName;

              return (
                <Fragment key={idx}>
                  {/* 登録名行（読み取り専用） */}
                  <tr>
                    <th>{PLAYER_LABELS[idx]}</th>
                    <td>
                      <span className="field-value field-value--readonly">
                        {stripHtml(playerName) || '(空欄)'}
                      </span>
                    </td>
                    <td className="action-cell" />
                  </tr>
                  {/* ゲーム内名前行 */}
                  <tr className="preview-ingame-row">
                    <th className="preview-ingame-label">↳ゲーム内</th>
                    <td>
                      {isEditingInGame ? (
                        <input
                          className="edit-input"
                          value={editInGame.value}
                          onChange={(e) => setEditInGame({ ...editInGame, value: e.target.value })}
                          onKeyDown={handleInGameKeyDown}
                          autoFocus
                        />
                      ) : (
                        <span className={`field-value${isDifferent ? ' field-value--ingame' : ''}`}>
                          {currentInGame || '(空欄)'}
                        </span>
                      )}
                    </td>
                    <td className="action-cell">
                      {isEditingInGame ? (
                        <>
                          <button className="btn-sm btn-save" onClick={saveInGameEdit}>保存</button>
                          <button className="btn-sm btn-cancel" onClick={cancelInGameEdit}>取消</button>
                        </>
                      ) : (
                        <button
                          className="btn-sm btn-edit"
                          onClick={() => startInGameEdit(playerName, currentInGame)}
                        >
                          編集
                        </button>
                      )}
                    </td>
                  </tr>
                </Fragment>
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
