import sharp from 'sharp';
import path from 'node:path';
import { ALPHA_REGIONS, BRAVO_REGIONS, scaleRegion, type SideRegions } from './regions';
import { annotateScreenshot } from './annotateScreenshot';
import { matchPlayerName, rasterizeTextDataUrl } from './matchPlayerName';
import { matchWeapon } from './matchWeapon';
import type {
  MatchCandidate,
  PickCandidate,
  Selection,
  TeamsPool,
} from '../../schemas';
import type { Mode, Side, PickPosition } from '../../nodecg/messages';

type RawEntry = {
  rankedNames: { name: string; score: number }[];
  rankedWeapons: { id: string; score: number }[];
  nameImageDataUrl: string;
  weaponImageDataUrl: string;
};

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
 * 指定モードの アルファ/ブラボー 両選択チームに対して OCR を実行し、判定結果を matchCandidate として返す。
 * 選択が未完了 or チームが見つからない場合は null を返す（呼び出し側で無視）。
 */
export async function processScreenshot(
  input: ProcessInput
): Promise<MatchCandidate | null> {
  const { screenshotPath, sourceFile, mode, selection, teamsPool, log } = input;

  const slot = selection[mode];
  if (!slot.alpha || !slot.bravo) {
    log.warn(`[ocr] ${mode}: アルファ/ブラボー 未選択のためスキップ`);
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
    alphaTeam.players,
    'alpha',
    log
  );
  const bravoPicks = await ocrSide(
    screenshotPath,
    width,
    height,
    BRAVO_REGIONS,
    bravoTeam.players,
    'bravo',
    log
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
  playerCandidates: readonly [string, string, string, string],
  side: Side,
  log: Logger,
): Promise<NonNullable<MatchCandidate>['alpha']['picks']> {
  const positions: PickPosition[] = [0, 1, 2, 3];

  // フェーズ1: OCR スコアリング（逐次：ポジションごとに処理してイベントループを解放）
  const raw: RawEntry[] = [];
  for (const i of positions) {
    const nameRegion = scaleRegion(regions.names[i], width, height);
    const weaponRegion = scaleRegion(regions.weapons[i], width, height);
    const [rankedNames, rankedWeapons, nameImageDataUrl, weaponImageDataUrl] = await Promise.all([
      matchPlayerName(screenshotPath, nameRegion, playerCandidates),
      matchWeapon(screenshotPath, weaponRegion, width, height),
      sharp(screenshotPath)
        .extract({ left: nameRegion.x, top: nameRegion.y, width: nameRegion.w, height: nameRegion.h })
        .grayscale()
        .png()
        .toBuffer()
        .then((buf) => `data:image/png;base64,${buf.toString('base64')}`),
      sharp(screenshotPath)
        .extract({ left: weaponRegion.x, top: weaponRegion.y, width: weaponRegion.w, height: weaponRegion.h })
        .png()
        .toBuffer()
        .then((buf) => `data:image/png;base64,${buf.toString('base64')}`),
    ]);
    raw.push({ rankedNames, rankedWeapons, nameImageDataUrl, weaponImageDataUrl });
  }

  // フェーズ1後: デバッグログ
  const PLAYER_MAX_MSE = 255 * 255;
  for (let i = 0; i < positions.length; i++) {
    const { rankedNames, rankedWeapons } = raw[i];
    const playerLines = rankedNames
      .map((s) => `  "${s.name}" → ${Math.max(0, (1 - s.score / PLAYER_MAX_MSE) * 100).toFixed(1)}%`)
      .join('\n');
    const weaponLines = rankedWeapons
      .slice(0, 5)
      .map((s) => `  "${s.id}" → ${(s.score * 100).toFixed(1)}%`)
      .join('\n');
    log.info(`[ocr] ${side} pos=${i}\n[player scores]\n${playerLines}\n[weapon top5]\n${weaponLines}`);
  }

  // フェーズ2: 重複なし自動選択（逐次）
  const selectedNames = assignUnique(raw.map((r) => r.rankedNames.map((s) => s.name)));

  // フェーズ3: 比較画像生成（並列）
  const compareImages = await Promise.all(
    selectedNames.map((name) =>
      name ? rasterizeTextDataUrl(name).then((v) => v ?? undefined) : Promise.resolve(undefined)
    )
  );

  // フェーズ4: PickCandidate 組み立て
  const picks = positions.map((i): PickCandidate => ({
    position: i,
    playerCandidates: raw[i].rankedNames.map((s) => s.name),
    weaponCandidates: raw[i].rankedWeapons.map((s) => s.id),
    selected: {
      playerName: selectedNames[i],
      weaponId: raw[i].rankedWeapons[0]?.id ?? '',
    },
    nameImageDataUrl: raw[i].nameImageDataUrl,
    nameCompareDataUrl: compareImages[i],
    weaponImageDataUrl: raw[i].weaponImageDataUrl,
  }));
  return [picks[0], picks[1], picks[2], picks[3]];
}

function assignUnique(rankedLists: string[][]): string[] {
  const used = new Set<string>();
  return rankedLists.map((ranked) => {
    const pick = ranked.find((name) => name !== '' && !used.has(name)) ?? ranked[0] ?? '';
    if (pick) used.add(pick);
    return pick;
  });
}

