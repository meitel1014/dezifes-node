import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WEAPON_IMG_DIR = path.resolve(process.cwd(), 'data/weapon_flat_10_0_0');
const CANON_SIZE = 50;
const N = CANON_SIZE * CANON_SIZE; // ピクセル数（1チャネル）

// ── テンプレートキャッシュ ────────────────────────────

type Template = {
  id: string;
  rgb: Float32Array; // [R,G,B, R,G,B, ...] 正規化済み (0–1)、N*3 要素
  alpha: Float32Array; // マスク (0–1)、N 要素
};

let templateCache: Template[] | null = null;

export async function loadWeaponTemplates(): Promise<Template[]> {
  if (templateCache) return templateCache;
  if (!fs.existsSync(WEAPON_IMG_DIR)) return (templateCache = []);

  const files = fs.readdirSync(WEAPON_IMG_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  const templates: Template[] = [];
  for (const file of files) {
    const id = file.replace(/\.png$/i, '');
    const { data, info } = await sharp(path.join(WEAPON_IMG_DIR, file))
      .ensureAlpha()
      .resize(CANON_SIZE, CANON_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgb = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rgb[i * 3]     = data[i * info.channels]     / 255;
      rgb[i * 3 + 1] = data[i * info.channels + 1] / 255;
      rgb[i * 3 + 2] = data[i * info.channels + 2] / 255;
      alpha[i] = info.channels === 4 ? data[i * info.channels + 3] / 255 : 1;
    }
    templates.push({ id, rgb, alpha });
  }
  return (templateCache = templates);
}

// ── 正規化相互相関（NCC）───────────────────────��─────
// score = ΣAB·M / √(ΣA²·M × ΣB²·M)  (全チャネル合算)
function ncc(src: Float32Array, tmpl: Float32Array, mask: Float32Array): number {
  let sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < N; i++) {
    const m = mask[i];
    if (m < 0.5) continue;
    for (let c = 0; c < 3; c++) {
      const a = src[i * 3 + c];
      const b = tmpl[i * 3 + c];
      sumAB += a * b * m;
      sumA2 += a * a * m;
      sumB2 += b * b * m;
    }
  }
  const denom = Math.sqrt(sumA2 * sumB2);
  return denom === 0 ? 0 : sumAB / denom;
}

// ── matchWeapon ───────────────────────────────────────

export async function matchWeapon(
  screenshotPath: string,
  region: { x: number; y: number; w: number; h: number },
  imgWidth: number,
  imgHeight: number,
): Promise<{ id: string; score: number }[]> {
  const templates = await loadWeaponTemplates();
  if (templates.length === 0) return [];

  // 領域をそのまま CANON_SIZE にリサイズして比較
  const left   = Math.max(0, region.x);
  const top    = Math.max(0, region.y);
  const width  = Math.min(imgWidth  - left, region.w);
  const height = Math.min(imgHeight - top,  region.h);

  const { data, info } = await sharp(screenshotPath)
    .extract({ left, top, width, height })
    .resize(CANON_SIZE, CANON_SIZE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    src[i * 3]     = data[i * info.channels]     / 255;
    src[i * 3 + 1] = data[i * info.channels + 1] / 255;
    src[i * 3 + 2] = data[i * info.channels + 2] / 255;
  }

  const ranked = templates.map((t) => ({ id: t.id, score: ncc(src, t.rgb, t.alpha) }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
