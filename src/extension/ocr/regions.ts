/**
 * スクショ内の切り出し領域定義（1920×1080 基準）。
 * 数値は data/スクショサンプル.png の目測に基づく暫定値。
 * 実運用で精度が出ない場合はここを調整する（運用者向けの唯一の調整ポイント）。
 *
 * Splatoon3 の試合開始画面は：
 * - α 側が画面左、4 行分（X/Y/B/A ボタン順に上から）
 * - β 側が画面右、4 行分（同様）
 * - 各行 = ボタンアイコン + プレイヤー名 + ブキアイコン
 */

export type Region = { x: number; y: number; w: number; h: number };
export type Picks4<T> = [T, T, T, T];
export type SideRegions = {
  names: Picks4<Region>;
  weapons: Picks4<Region>;
};

export const REFERENCE_WIDTH = 1920;
export const REFERENCE_HEIGHT = 1080;

const ROW_TOP = 180;
const ROW_STRIDE = 170;
const ROW_H = 80;
const WEAPON_SIZE = 110;

function rows<T>(make: (i: 0 | 1 | 2 | 3) => T): Picks4<T> {
  return [make(0), make(1), make(2), make(3)];
}

export const ALPHA_REGIONS: SideRegions = {
  names: rows((i) => ({
    x: 140,
    y: ROW_TOP + ROW_STRIDE * i,
    w: 480,
    h: ROW_H,
  })),
  weapons: rows((i) => ({
    x: 640,
    y: ROW_TOP + ROW_STRIDE * i - 10,
    w: WEAPON_SIZE,
    h: WEAPON_SIZE,
  })),
};

export const BRAVO_REGIONS: SideRegions = {
  names: rows((i) => ({
    x: REFERENCE_WIDTH - 140 - 480,
    y: ROW_TOP + ROW_STRIDE * i,
    w: 480,
    h: ROW_H,
  })),
  weapons: rows((i) => ({
    x: REFERENCE_WIDTH - 640 - WEAPON_SIZE,
    y: ROW_TOP + ROW_STRIDE * i - 10,
    w: WEAPON_SIZE,
    h: WEAPON_SIZE,
  })),
};

/**
 * 実画像サイズ（width, height）に応じて参照座標を等倍スケーリング。
 * 1920×1080 以外の解像度でも動くように。
 */
export function scaleRegion(region: Region, width: number, height: number): Region {
  const sx = width / REFERENCE_WIDTH;
  const sy = height / REFERENCE_HEIGHT;
  return {
    x: Math.round(region.x * sx),
    y: Math.round(region.y * sy),
    w: Math.round(region.w * sx),
    h: Math.round(region.h * sy),
  };
}
