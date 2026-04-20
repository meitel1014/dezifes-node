import type {
  TeamsPool,
  Selection,
  Visibility,
  Matches,
  MatchCandidates,
  WeaponAliases,
} from '../schemas';

/**
 * すべてのReplicantの型を定義するマップ
 */
export type ReplicantMap = {
  teamsPool: TeamsPool;
  selection: Selection;
  visibility: Visibility;
  matches: Matches;
  matchCandidates: MatchCandidates;
  weaponAliases: WeaponAliases;
};
