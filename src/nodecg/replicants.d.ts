import type { TeamsPool, Selection, Visibility } from '../schemas';

/**
 * すべてのReplicantの型を定義するマップ
 */
export type ReplicantMap = {
  teamsPool: TeamsPool;
  selection: Selection;
  visibility: Visibility;
};
