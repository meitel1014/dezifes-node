import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WEAPON_IMG_DIR = path.resolve(process.cwd(), 'data/weapon_flat_10_0_0');
const CANON_SIZE = 59;
const N = CANON_SIZE * CANON_SIZE; // ピクセル数（1チャネル）
const ZNCC_BATCH = 15; // 何テンプレートごとに setImmediate で yield するか

const yieldToEventLoop = (): Promise<void> => new Promise((r) => setImmediate(r));

// ── テンプレートキャッシュ ────────────────────────────

type Template = {
  id: string;
  rgb: Float32Array;   // [R,G,B, ...] 正規化済み (0–1)、N*3 要素
  alpha: Float32Array; // マスク (0–1)、N 要素
  mean: number;        // ZNCC 用：加重平均（全チャネル合算）
};

let templateCache: Template[] | null = null;

type WarnLogger = (message: string, ...args: unknown[]) => void;

export async function loadWeaponTemplates(warn?: WarnLogger): Promise<Template[]> {
  if (templateCache) return templateCache;
  if (!fs.existsSync(WEAPON_IMG_DIR)) return (templateCache = []);

  const files = fs.readdirSync(WEAPON_IMG_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  const templates: Template[] = [];
  for (const file of files) {
    const id = file.replace(/\.png$/i, '');
    try {
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
      // ZNCC 用：テンプレートの加重平均を事前計算してキャッシュ
      let wSum = 0, valSum = 0;
      for (let i = 0; i < N; i++) {
        const m = alpha[i];
        if (m < 0.5) continue;
        for (let c = 0; c < 3; c++) valSum += rgb[i * 3 + c] * m;
        wSum += m * 3;
      }
      const mean = wSum > 0 ? valSum / wSum : 0;
      templates.push({ id, rgb, alpha, mean });
    } catch (e) {
      warn?.(`[matchWeapon] Failed to load template "${file}", skipping`, e);
    }
  }
  return (templateCache = templates);
}

// ── ゼロ平均正規化相互相関（ZNCC / TM_CCOEFF_NORMED 相当）──────
// score = Σ(A-Ā)(B-B̄)·M / √(Σ(A-Ā)²·M × Σ(B-B̄)²·M)
// B̄ はテンプレート側の加重平均（事前計算済み）。
// Ā はソース側の加重平均（毎回計算）。
// 白一色などコントラストのないテンプレートは B̄≈B となり分母→0→score=0。
function zncc(src: Float32Array, tmpl: Float32Array, mask: Float32Array, tmplMean: number): number {
  // ソース側の加重平均を計算
  let wSum = 0, srcValSum = 0;
  for (let i = 0; i < N; i++) {
    const m = mask[i];
    if (m < 0.5) continue;
    for (let c = 0; c < 3; c++) srcValSum += src[i * 3 + c] * m;
    wSum += m * 3;
  }
  const srcMean = wSum > 0 ? srcValSum / wSum : 0;

  let sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < N; i++) {
    const m = mask[i];
    if (m < 0.5) continue;
    for (let c = 0; c < 3; c++) {
      const a = src[i * 3 + c] - srcMean;
      const b = tmpl[i * 3 + c] - tmplMean;
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

  const ranked: { id: string; score: number }[] = [];
  for (let b = 0; b < templates.length; b += ZNCC_BATCH) {
    for (let j = b; j < Math.min(b + ZNCC_BATCH, templates.length); j++) {
      const t = templates[j];
      ranked.push({ id: t.id, score: zncc(src, t.rgb, t.alpha, t.mean) });
    }
    await yieldToEventLoop();
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
