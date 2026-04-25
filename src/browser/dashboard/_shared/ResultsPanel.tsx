import './ResultsPanel.css';
import { Fragment, useMemo, useRef, useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';
import { stripHtml } from '../../utils/stripHtml';
import { Html } from '../../components/Html';
import type { Mode, Side, PickPosition } from '@/nodecg/messages';
import type {
  InGameNames,
  Match,
  MatchCandidate,
  StageNames,
  TeamsPool,
  WeaponAliases,
} from '@/schemas';

type Props = { mode: Mode };

const TOP_N_WEAPONS = 10;

function weaponLabel(id: string, aliases: WeaponAliases | undefined): string {
  if (!id) return '(未選択)';
  return aliases?.[id] ?? id;
}

export function ResultsPanel({ mode }: Props) {
  const [candidates] = useReplicant('matchCandidates');
  const [teamsPool] = useReplicant('teamsPool');
  const [matches] = useReplicant('matches');
  const [aliases] = useReplicant('weaponAliases');
  const [selection] = useReplicant('selection');
  const [stageNames] = useReplicant('stageNames');
  const [inGameNames] = useReplicant('inGameNames');
  const [showAllWeapons, setShowAllWeapons] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCountRef = useRef(0);

  const recentMatches = useMemo(
    () => [...(matches ?? [])].reverse().slice(0, 5),
    [matches]
  );
  const fullWeaponList = useMemo<string[]>(
    () => Object.keys(aliases ?? {}).sort(),
    [aliases]
  );

  if (!candidates || !teamsPool || !matches || !selection) {
    return <p>読み込み中…</p>;
  }

  const queue = candidates[mode];

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    dragCountRef.current--;
    if (dragCountRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.png') || !file.type.startsWith('image/png')) {
      setUploadError('PNG ファイルをドロップしてください');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/weapons', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(data.error ?? `エラー (HTTP ${res.status})`);
      }
    } catch {
      setUploadError('アップロード失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const dropZoneProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: (e: React.DragEvent) => { void handleDrop(e); },
  };

  return (
    <div className="results-panel">
      {queue.length === 0 ? (
        <div
          className={`results-empty${isDragging ? ' results-empty--dragging' : ''}`}
          {...dropZoneProps}
        >
          {isUploading ? (
            <p>OCR 処理中…</p>
          ) : (
            <>
              <p>両チームが表示状態の時、試合開始時自動的にマップ画面を読み取ります。</p>
              <p className="results-drop-hint">
                {isDragging ? 'ここにドロップ' : '送信されなかった場合、 PNG をここにドロップ'}
              </p>
              {uploadError && <p className="results-drop-error">{uploadError}</p>}
              <button
                className="btn btn-manual"
                onClick={() => void nodecg.sendMessage('addManualCandidate', { mode })}
              >
                手動で入力
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="results-queue">
          {queue.map((cand, idx) => (
            <Fragment key={cand.sourceFile + cand.createdAt}>
              <div className="results-queue-item">
                <div className="results-queue-badge">
                  候補 {idx + 1} / {queue.length}
                </div>
                <CandidateEditor
                  mode={mode}
                  candidateIndex={idx}
                  cand={cand}
                  aliases={aliases}
                  teamsPool={teamsPool}
                  stageNames={stageNames}
                  inGameNames={inGameNames}
                  showAllWeapons={showAllWeapons}
                  setShowAllWeapons={setShowAllWeapons}
                  fullWeaponList={fullWeaponList}
                />
              </div>
              {idx === 0 && (
                <div
                  className={`results-drop-compact${isDragging ? ' results-drop-compact--dragging' : ''}`}
                  {...dropZoneProps}
                >
                  {isUploading ? (
                    <span>OCR 処理中…</span>
                  ) : (
                    <span className="results-drop-hint">
                      {isDragging ? 'ここにドロップ' : '次の PNG をここにドロップ'}
                    </span>
                  )}
                  {uploadError && <span className="results-drop-error">{uploadError}</span>}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      <section className="results-history">
        <h4>最新の確定履歴（最大 5 件）</h4>
        {recentMatches.length === 0 ? (
          <p className="results-empty-sm">まだ確定済みの試合はありません。</p>
        ) : (
          <ul>
            {recentMatches.map((m) => (
              <HistoryItem key={m.id} match={m} aliases={aliases} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── 判定結果エディタ（未確定 candidate の編集 UI） ─────────────

type EditorProps = {
  mode: Mode;
  candidateIndex: number;
  cand: MatchCandidate;
  aliases: WeaponAliases | undefined;
  teamsPool: TeamsPool;
  stageNames: StageNames | undefined;
  inGameNames: InGameNames | undefined;
  showAllWeapons: Record<string, boolean>;
  setShowAllWeapons: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fullWeaponList: string[];
};

function CandidateEditor({
  mode,
  candidateIndex,
  cand,
  aliases,
  teamsPool,
  stageNames,
  inGameNames,
  showAllWeapons,
  setShowAllWeapons,
  fullWeaponList,
}: EditorProps) {
  const alphaTeam = teamsPool[mode].find((t) => t.id === cand.alpha.teamId) ?? null;
  const bravoTeam = teamsPool[mode].find((t) => t.id === cand.bravo.teamId) ?? null;

  const handleConfirm = () => {
    if (!cand.stageName) {
      alert('ステージを選択してください');
      return;
    }
    if (!cand.wonSide) {
      alert('勝利チームを選択してください');
      return;
    }
    for (const side of ['alpha', 'bravo'] as const) {
      const names = cand[side].picks.map((p) => p.selected.playerName).filter(Boolean);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      if (dupes.length > 0) {
        alert(`${side === 'alpha' ? 'アルファ' : 'ブラボー'}に同じプレイヤー名が複数選択されています：${[...new Set(dupes)].join('、')}`);
        return;
      }
    }
    void nodecg.sendMessage('confirmMatchCandidate', { mode, candidateIndex });
    setShowAllWeapons({});
  };
  const handleWonSideChange = (side: Side) => {
    const newWonSide = cand.wonSide === side ? null : side;
    void nodecg.sendMessage('setMatchCandidateWonSide', { mode, candidateIndex, wonSide: newWonSide });
  };
  const handleDismiss = () => {
    void nodecg.sendMessage('dismissMatchCandidate', { mode, candidateIndex });
    setShowAllWeapons({});
  };
  const handlePlayerChange = (side: Side, position: PickPosition, playerName: string) => {
    void nodecg.sendMessage('updateMatchCandidate', {
      mode,
      candidateIndex,
      side,
      position,
      patch: { playerName },
    });
  };
  const handleStageChange = (stageName: string) => {
    void nodecg.sendMessage('setMatchCandidateStageName', { mode, candidateIndex, stageName });
  };
  const handleWeaponChange = (side: Side, position: PickPosition, weaponId: string) => {
    void nodecg.sendMessage('updateMatchCandidate', {
      mode,
      candidateIndex,
      side,
      position,
      patch: { weaponId },
    });
  };

  const renderSide = (side: Side) => {
    const team = side === 'alpha' ? alphaTeam : bravoTeam;
    const sideCand = cand[side];
    const playerOptions = team?.players ?? (['', '', '', ''] as const);

    return (
      <div className={`results-column results-${side}`}>
        <h3>
          <span>
            {side === 'alpha' ? 'アルファ' : 'ブラボー'} |{' '}
            <Html value={team?.id ?? '(未選択)'} />
          </span>
          <button
            className={`btn-sm btn-winner btn-winner--${side}${cand.wonSide === side ? ' btn-winner--selected' : ''}`}
            onClick={() => handleWonSideChange(side)}
          >
            勝利
          </button>
        </h3>
        <table className="results-table">
          <thead>
            <tr>
              <th></th>
              <th>プレイヤー</th>
              <th>ブキ</th>
            </tr>
          </thead>
          <tbody>
            {sideCand.picks.map((pick) => {
              const key = `${candidateIndex}-${side}-${pick.position}`;
              const showAll = showAllWeapons[key] ?? false;
              const weaponOptions = (showAll || pick.weaponCandidates.length === 0) && fullWeaponList.length > 0
                ? fullWeaponList
                : pick.weaponCandidates.slice(0, TOP_N_WEAPONS);

              return (
                <tr key={pick.position}>
                  <th>{pick.position + 1}</th>
                  <td>
                    {pick.nameImageDataUrl && (
                      <img className="name-region-img" src={pick.nameImageDataUrl} alt="" />
                    )}
                    <select
                      value={pick.selected.playerName}
                      onChange={(e) =>
                        handlePlayerChange(side, pick.position, e.target.value)
                      }
                    >
                      {pick.selected.playerName &&
                      !playerOptions.includes(pick.selected.playerName) ? (
                        <option value={pick.selected.playerName}>
                          {pick.selected.playerName}（候補外）
                        </option>
                      ) : null}
                      {playerOptions.map((name, i) => (
                        <option key={i} value={name}>
                          {stripHtml(name) || '(空欄)'}
                        </option>
                      ))}
                    </select>
                    {pick.selected.playerName && !cand.isManual ? (
                      <span className="player-ingame-name">
                        {inGameNames?.[pick.selected.playerName] ?? pick.selected.playerName}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {pick.weaponImageDataUrl && (
                      <img className="weapon-region-img" src={pick.weaponImageDataUrl} alt="" />
                    )}
                    <select
                      value={pick.selected.weaponId}
                      onChange={(e) =>
                        handleWeaponChange(side, pick.position, e.target.value)
                      }
                    >
                      {cand.isManual && <option value="">(未選択)</option>}
                      {pick.selected.weaponId &&
                      !weaponOptions.includes(pick.selected.weaponId) ? (
                        <option value={pick.selected.weaponId}>
                          {weaponLabel(pick.selected.weaponId, aliases)}
                        </option>
                      ) : null}
                      {weaponOptions.map((wid) => (
                        <option key={wid} value={wid}>
                          {weaponLabel(wid, aliases)}
                        </option>
                      ))}
                    </select>
                    {!cand.isManual && (
                      <label className="weapon-toggle">
                        <input
                          type="checkbox"
                          checked={showAll}
                          onChange={() =>
                            setShowAllWeapons((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                        />
                        すべて
                      </label>
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
    <div className="results-editor">
      <div className="results-source">
        {cand.isManual
          ? '手動入力'
          : <>元: <code>{cand.sourceFile}</code>（{new Date(cand.createdAt).toLocaleTimeString()}）</>
        }
      </div>
      <div className="results-stage">
        <label className="results-stage-label">ステージ</label>
        <select
          className="results-stage-select"
          value={cand.stageName ?? ''}
          onChange={(e) => handleStageChange(e.target.value)}
        >
          <option value="">(未設定)</option>
          {(stageNames?.[mode] ?? []).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {(() => {
          const score = cand.stageScores.find((s) => s.stageName === cand.stageName)?.score
            ?? (cand.stageName ? cand.stageScore : null);
          return score !== null && score !== undefined ? (
            <span className="results-stage-score">{(score * 100).toFixed(1)}%</span>
          ) : null;
        })()}
      </div>
      <div className="results-grid">
        {renderSide('alpha')}
        {renderSide('bravo')}
      </div>
      <div className="results-actions">
        <button className="btn btn-confirm" onClick={handleConfirm}>
          確定して記録
        </button>
        <button className="btn btn-dismiss" onClick={handleDismiss}>
          破棄
        </button>
      </div>
      {cand.annotatedFile && (
        <details className="results-annotated-details">
          <summary aria-label="判定領域の表示切替"></summary>
          <img
            className="results-annotated-img"
            src={`/annotated-screenshots/${cand.annotatedFile}`}
            alt="判定領域"
            loading="lazy"
          />
        </details>
      )}
    </div>
  );
}

// ── 履歴表示 ─────────────────────────────────

type HistoryItemProps = {
  match: Match;
  aliases: WeaponAliases | undefined;
};

function HistoryItem({ match, aliases }: HistoryItemProps) {
  const [open, setOpen] = useState(false);
  const alphaName = match.alpha.teamId;
  const bravoName = match.bravo.teamId;

  const handleDelete = () => {
    if (!confirm('この試合記録を削除しますか？')) return;
    void nodecg.sendMessage('deleteMatch', { id: match.id });
  };

  return (
    <li className="history-item">
      <button
        type="button"
        className="history-head"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="history-time">
          {new Date(match.timestamp).toLocaleTimeString()}
        </span>
        <span className="history-teams">
          <Html value={alphaName} /> <span className="vs">vs</span>{' '}
          <Html value={bravoName} />
        </span>
        <span className="history-toggle">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="history-detail">
          <HistorySide title="アルファ" name={alphaName} picks={match.alpha.picks} aliases={aliases} />
          <HistorySide title="ブラボー" name={bravoName} picks={match.bravo.picks} aliases={aliases} />
          <button className="btn-sm btn-cancel" onClick={handleDelete}>
            この記録を削除
          </button>
        </div>
      ) : null}
    </li>
  );
}

function HistorySide({
  title,
  name,
  picks,
  aliases,
}: {
  title: string;
  name: string;
  picks: Match['alpha']['picks'];
  aliases: WeaponAliases | undefined;
}) {
  return (
    <div className="history-side">
      <h5>
        {title}：<Html value={name} />
      </h5>
      <ol>
        {picks.map((p, i) => (
          <li key={i}>
            {stripHtml(p.playerName)} — {weaponLabel(p.weaponId, aliases)}
          </li>
        ))}
      </ol>
    </div>
  );
}
