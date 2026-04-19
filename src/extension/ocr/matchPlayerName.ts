import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';

const FONT_PATH = path.resolve(process.cwd(), 'data/Splatoon2-merged.ttf');
const TEXT_HEIGHT = 40; // 候補・領域共通の比較用高さ（px）
const RENDER_FONT_SIZE = 56; // opentype の getPath に渡す font size（高さはリサイズで揃える）

let fontCache: opentype.Font | null = null;

function loadFont(): opentype.Font | null {
  if (fontCache) return fontCache;
  if (!fs.existsSync(FONT_PATH)) return null;
  try {
    const buf = fs.readFileSync(FONT_PATH);
    // Buffer を ArrayBuffer に
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    fontCache = opentype.parse(ab);
    return fontCache;
  } catch {
    return null;
  }
}

/**
 * 文字列を指定フォントで PNG ラスタライズ（白文字・黒背景、グレースケール1ch）。
 * 戻り値は { data, width } 形式の raw バッファ（高さは常に TEXT_HEIGHT）。
 * 幅は文字列の実サイズに依存。
 */
async function rasterizeText(
  font: opentype.Font,
  text: string
): Promise<{ data: Buffer; width: number }> {
  const path2 = font.getPath(text, 0, RENDER_FONT_SIZE, RENDER_FONT_SIZE);
  const bbox = path2.getBoundingBox();
  const width = Math.max(1, Math.ceil(bbox.x2 - bbox.x1));
  const height = Math.max(1, Math.ceil(bbox.y2 - bbox.y1));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bbox.x1} ${bbox.y1} ${width} ${height}"><rect x="${bbox.x1}" y="${bbox.y1}" width="${width}" height="${height}" fill="black"/><path d="${path2.toPathData(2)}" fill="white"/></svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .resize({ height: TEXT_HEIGHT })
    .grayscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

/**
 * スクショの名前領域を同じ TEXT_HEIGHT にリサイズしグレースケール化。
 * 部分一致評価用に領域画像と候補画像をスライドさせて MSE を取る。
 */
async function rasterizeRegion(
  screenshotPath: string,
  region: { x: number; y: number; w: number; h: number }
): Promise<{ data: Buffer; width: number }> {
  const { data, info } = await sharp(screenshotPath)
    .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
    .resize({ height: TEXT_HEIGHT })
    .grayscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

function computeSlidingMse(
  region: { data: Buffer; width: number },
  cand: { data: Buffer; width: number }
): number {
  const rw = region.width;
  const cw = cand.width;
  const h = TEXT_HEIGHT;

  if (cw > rw) {
    // 候補の方が長い場合は全体比較のみ
    let sum = 0;
    const compareW = rw;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < compareW; x++) {
        const d = region.data[y * rw + x] - cand.data[y * cw + x];
        sum += d * d;
      }
    }
    return sum / (compareW * h);
  }

  let best = Infinity;
  const stride = Math.max(1, Math.floor(cw / 20));
  for (let offset = 0; offset + cw <= rw; offset += stride) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      const rRow = y * rw + offset;
      const cRow = y * cw;
      for (let x = 0; x < cw; x++) {
        const d = region.data[rRow + x] - cand.data[cRow + x];
        sum += d * d;
      }
    }
    const mse = sum / (cw * h);
    if (mse < best) best = mse;
  }
  return best;
}

/**
 * 切り出し領域に対し、4 人の候補名のうちどれが最も一致するかスコア降順で返す。
 * フォントがロードできない場合は先頭候補をそのまま返す（デグラデーション）。
 */
export async function matchPlayerName(
  screenshotPath: string,
  region: { x: number; y: number; w: number; h: number },
  candidates: readonly string[]
): Promise<string[]> {
  const font = loadFont();
  if (!font || candidates.length === 0) return [...candidates];

  const regionRaster = await rasterizeRegion(screenshotPath, region);
  const scored: { name: string; score: number }[] = [];
  for (const name of candidates) {
    if (!name) {
      scored.push({ name, score: Infinity });
      continue;
    }
    try {
      const cand = await rasterizeText(font, name);
      const score = computeSlidingMse(regionRaster, cand);
      scored.push({ name, score });
    } catch {
      scored.push({ name, score: Infinity });
    }
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.name);
}
