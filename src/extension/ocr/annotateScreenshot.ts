import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { ALPHA_REGIONS, BRAVO_REGIONS, scaleRegion } from './regions';

const ALPHA_COLOR = '#fefe14';
const BRAVO_COLOR = '#8870f6';
const STROKE = 1;
const OUT_W = 960;
const OUT_H = 540;

export async function annotateScreenshot(
  screenshotPath: string,
  annotatedDir: string
): Promise<string> {
  fs.mkdirSync(annotatedDir, { recursive: true });
  const filename = path.basename(screenshotPath);
  const annotatedPath = path.join(annotatedDir, filename);

  // SVG 座標は出力サイズ基準（先にリサイズ→後にコンポジット）
  const rects: string[] = [];
  for (let i = 0; i < 4; i++) {
    for (const [regions, color] of [
      [ALPHA_REGIONS, ALPHA_COLOR],
      [BRAVO_REGIONS, BRAVO_COLOR],
    ] as const) {
      const nr = scaleRegion(regions.names[i], OUT_W, OUT_H);
      const wr = scaleRegion(regions.weapons[i], OUT_W, OUT_H);
      rects.push(
        `<rect x="${nr.x}" y="${nr.y}" width="${nr.w}" height="${nr.h}" fill="none" stroke="${color}" stroke-width="${STROKE}"/>`,
        `<rect x="${wr.x}" y="${wr.y}" width="${wr.w}" height="${wr.h}" fill="none" stroke="${color}" stroke-width="${STROKE}"/>`
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">${rects.join('')}</svg>`;

  await sharp(screenshotPath)
    .resize(OUT_W, OUT_H, { fit: 'fill' })
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .toFile(annotatedPath);

  return filename;
}
