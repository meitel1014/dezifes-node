import type { MatchCandidate, MatchCandidates } from '../schemas';
import type { Mode } from '../nodecg/messages';

export const QUEUE_MAX = 10;

export function pushToQueue(cur: MatchCandidates, mode: Mode, cand: MatchCandidate): MatchCandidates {
  const queue = cur[mode] ?? [];
  const next =
    queue.length >= QUEUE_MAX
      ? [...queue.slice(1), cand] // 最古を捨てて末尾に追加
      : [...queue, cand];
  return { ...cur, [mode]: next };
}
