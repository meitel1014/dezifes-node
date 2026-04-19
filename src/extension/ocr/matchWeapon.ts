import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WEAPON_IMG_DIR = path.resolve(process.cwd(), 'data/weapon_flat_10_0_0');
const CANON_SIZE = 48; // テンプレート比較サイズ（小さめで速度優先）

type Template = {
  id: string;
  /** RGB (3ch) の raw Buffer (CANON_SIZE × CANON_SIZE) */
  rgb: Buffer;
  /** アルファマスク (1ch), 0-255。閾値以上のピクセルのみ比較対象に */
  alpha: Buffer;
};

let cache: Template[] | null = null;

/**
 * ブキ 173 枚を CANON_SIZE 四方の raw バッファとしてキャッシュ。
 * アルファチャネルを保持し、比較時は前景ピクセルのみを使って背景色の影響を抑える。
 */
export async function loadWeaponTemplates(): Promise<Template[]> {
  if (cache) return cache;
  if (!fs.existsSync(WEAPON_IMG_DIR)) return (cache = []);

  const files = fs.readdirSync(WEAPON_IMG_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  const templates: Template[] = [];
  for (const file of files) {
    const id = file.replace(/\.png$/i, '');
    const full = path.join(WEAPON_IMG_DIR, file);
    const { data, info } = await sharp(full)
      .ensureAlpha()
      .resize(CANON_SIZE, CANON_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // info.channels は 4 (RGBA) のはず
    const rgb = Buffer.alloc(CANON_SIZE * CANON_SIZE * 3);
    const alpha = Buffer.alloc(CANON_SIZE * CANON_SIZE);
    for (let i = 0; i < CANON_SIZE * CANON_SIZE; i++) {
      rgb[i * 3] = data[i * info.channels];
      rgb[i * 3 + 1] = data[i * info.channels + 1];
      rgb[i * 3 + 2] = data[i * info.channels + 2];
      alpha[i] = info.channels === 4 ? data[i * info.channels + 3] : 255;
    }
    templates.push({ id, rgb, alpha });
  }
  cache = templates;
  return cache;
}

/**
 * スクショの PNG バッファと切り出し領域から、ブキ ID 候補をスコア降順で返す。
 */
export async function matchWeapon(
  screenshotPath: string,
  region: { x: number; y: number; w: number; h: number }
): Promise<string[]> {
  const templates = await loadWeaponTemplates();
  if (templates.length === 0) return [];

  const { data: target } = await sharp(screenshotPath)
    .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
    .ensureAlpha()
    .resize(CANON_SIZE, CANON_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // MSE はアルファの大きいピクセルのみを重みづけして計算
  const ranked = templates.map((t) => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < CANON_SIZE * CANON_SIZE; i++) {
      const a = t.alpha[i];
      if (a < 32) continue; // ほぼ透明なピクセルはスキップ
      const dr = target[i * 3] - t.rgb[i * 3];
      const dg = target[i * 3 + 1] - t.rgb[i * 3 + 1];
      const db = target[i * 3 + 2] - t.rgb[i * 3 + 2];
      sum += dr * dr + dg * dg + db * db;
      count++;
    }
    const score = count > 0 ? sum / count : Infinity;
    return { id: t.id, score };
  });
  ranked.sort((a, b) => a.score - b.score);
  return ranked.map((r) => r.id);
}
