import type {
  ActiveMode,
  TeamsPool,
  Selection,
  Visibility,
  Matches,
  MatchCandidates,
  WeaponAliases,
  ScreenshotDir,
  GoogleSheetSync,
  GasEndpointConfigured,
  StageNames,
} from '../schemas';

/**
 * すべてのReplicantの型を定義するマップ
 */
export type ReplicantMap = {
  activeMode: ActiveMode;
  teamsPool: TeamsPool;
  selection: Selection;
  visibility: Visibility;
  matches: Matches;
  matchCandidates: MatchCandidates;
  weaponAliases: WeaponAliases;
  screenshotDir: ScreenshotDir;
  googleSheetSync: GoogleSheetSync;
  gasEndpointConfigured: GasEndpointConfigured;
  stageNames: StageNames;
};
