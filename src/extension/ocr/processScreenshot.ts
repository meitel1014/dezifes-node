import sharp from 'sharp';
import path from 'node:path';
import { ALPHA_REGIONS, BRAVO_REGIONS, scaleRegion, type SideRegions } from './regions';
import { annotateScreenshot } from './annotateScreenshot';
import { matchPlayerName } from './matchPlayerName';
import { matchWeapon } from './matchWeapon';
import type {
  MatchCandidate,
  PickCandidate,
  Selection,
  TeamsPool,
} from '../../schemas';
import type { Mode, Side, PickPosition } from '../../nodecg/messages';

type Logger = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

type ProcessInput = {
  screenshotPath: string;
  sourceFile: string;
  mode: Mode;
  selection: Selection;
  teamsPool: TeamsPool;
  log: Logger;
};

/**
 * 指定モードの α/β 両選択チームに対して OCR を実行し、判定結果を matchCandidate として返す。
 * 選択が未完了 or チームが見つからない場合は null を返す（呼び出し側で無視）。
 */
export async function processScreenshot(
  input: ProcessInput
): Promise<MatchCandidate | null> {
  const { screenshotPath, sourceFile, mode, selection, teamsPool, log } = input;

  const slot = selection[mode];
  if (!slot.alpha || !slot.bravo) {
    log.warn(`[ocr] ${mode}: α/β 未選択のためスキップ`);
    return null;
  }
  const alphaTeam = teamsPool[mode].find((t) => t.id === slot.alpha);
  const bravoTeam = teamsPool[mode].find((t) => t.id === slot.bravo);
  if (!alphaTeam || !bravoTeam) {
    log.warn(`[ocr] ${mode}: 選択中のチームが teamsPool に見つからない`);
    return null;
  }

  const meta = await sharp(screenshotPath).metadata();
  const width = meta.width ?? 1920;
  const height = meta.height ?? 1080;

  const alphaPicks = await ocrSide(
    screenshotPath,
    width,
    height,
    ALPHA_REGIONS,
    alphaTeam.players
  );
  const bravoPicks = await ocrSide(
    screenshotPath,
    width,
    height,
    BRAVO_REGIONS,
    bravoTeam.players
  );

  let annotatedFile: string | undefined;
  try {
    const annotatedDir = path.join(path.dirname(screenshotPath), 'annotated');
    annotatedFile = await annotateScreenshot(screenshotPath, annotatedDir);
  } catch (e) {
    log.warn('[ocr] annotation failed', e);
  }

  return {
    sourceFile,
    annotatedFile,
    createdAt: new Date().toISOString(),
    alpha: { teamId: alphaTeam.id, picks: alphaPicks },
    bravo: { teamId: bravoTeam.id, picks: bravoPicks },
  };
}

async function ocrSide(
  screenshotPath: string,
  width: number,
  height: number,
  regions: SideRegions,
  playerCandidates: readonly [string, string, string, string]
): Promise<NonNullable<MatchCandidate>['alpha']['picks']> {
  const positions: PickPosition[] = [0, 1, 2, 3];

  const picks = await Promise.all(
    positions.map(async (i) => {
      const nameRegion = scaleRegion(regions.names[i], width, height);
      const weaponRegion = scaleRegion(regions.weapons[i], width, height);

      const [rankedNames, rankedWeapons] = await Promise.all([
        matchPlayerName(screenshotPath, nameRegion, playerCandidates),
        matchWeapon(screenshotPath, weaponRegion),
      ]);

      const pick: PickCandidate = {
        position: i,
        playerCandidates: rankedNames,
        weaponCandidates: rankedWeapons,
        selected: {
          playerName: rankedNames[0] ?? '',
          weaponId: rankedWeapons[0] ?? '',
        },
      };
      return pick;
    })
  );
  return [picks[0], picks[1], picks[2], picks[3]];
}

// 未使用警告回避用（Side は今後のモード別分岐で使用するかも）
export type _SideRef = Side;
