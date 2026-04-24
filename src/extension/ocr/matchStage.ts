import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const STAGES_BASE_DIR = path.resolve(process.cwd(), 'data/stages');
// 1920×1080 の上 250px を除外した判定領域（原寸）
const CROP_TOP_1080 = 250;

const yieldToEventLoop = (): Promise<void> => new Promise((r) => setImmediate(r));

type StageTemplate = {
  stageName: string;
  rgb: Float32Array;              // N*3 (N=width*height)、正規化済み 0–1
  mean: [number, number, number]; // ZNCC 用チャネル別平均
  width: number;
  height: number;
};

const templateCache: { turfWar: StageTemplate[] | null; splatZones: StageTemplate[] | null } = {
  turfWar: null,
  splatZones: null,
};

type WarnLogger = (message: string, ...args: unknown[]) => void;
type Mode = 'turfWar' | 'splatZones';

async function extractRgb(
  imgPath: string,
  cropTop: number,
  cropH: number,
  imgW: number,
  resizeW?: number,
  resizeH?: number,
): Promise<{ rgb: Float32Array; mean: [number, number, number]; width: number; height: number }> {
  let pipeline = sharp(imgPath).extract({ left: 0, top: cropTop, width: imgW, height: cropH });
  if (resizeW !== undefined && resizeH !== undefined) {
    pipeline = pipeline.resize(resizeW, resizeH, { fit: 'fill' });
  }
  const { data, info } = await pipeline.removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    rgb[i * 3]     = data[i * info.channels]     / 255;
    rgb[i * 3 + 1] = data[i * info.channels + 1] / 255;
    rgb[i * 3 + 2] = data[i * info.channels + 2] / 255;
  }
  const sum = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) sum[c] += rgb[i * 3 + c];
  }
  const mean: [number, number, number] = [sum[0] / n, sum[1] / n, sum[2] / n];
  return { rgb, mean, width: info.width, height: info.height };
}

export async function loadStageTemplates(mode: Mode, warn?: WarnLogger): Promise<StageTemplate[]> {
  if (templateCache[mode]) return templateCache[mode]!;

  const dir = path.join(STAGES_BASE_DIR, mode);
  if (!fs.existsSync(dir)) {
    warn?.(`[matchStage] ディレクトリが存在しません: ${dir}`);
    return (templateCache[mode] = []);
  }

  const txtPath = path.join(dir, 'stages.txt');
  if (!fs.existsSync(txtPath)) {
    warn?.(`[matchStage] stages.txt が存在しません: ${txtPath}`);
    return (templateCache[mode] = []);
  }

  const stageNames = fs
    .readFileSync(txtPath, 'utf-8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const templates: StageTemplate[] = [];
  for (const stageName of stageNames) {
    const pngPath = path.join(dir, `${stageName}.png`);
    if (!fs.existsSync(pngPath)) {
      warn?.(`[matchStage] テンプレート PNG が存在しません: ${pngPath}`);
      continue;
    }
    try {
      const meta = await sharp(pngPath).metadata();
      const imgW = meta.width ?? 1920;
      const imgH = meta.height ?? 1080;
      const cropTop = Math.round(CROP_TOP_1080 * (imgH / 1080));
      const cropH = imgH - cropTop;

      const { rgb, mean, width, height } = await extractRgb(pngPath, cropTop, cropH, imgW);
      templates.push({ stageName, rgb, mean, width, height });
    } catch (e) {
      warn?.(`[matchStage] テンプレートのロードに失敗しました: "${stageName}"`, e);
    }
  }

  return (templateCache[mode] = templates);
}

// アルファマスクなし RGB ZNCC
// score = Σ_c Σ_i (A_c - Ā_c)(B_c - B̄_c) / √(Σ(A-Ā)² × Σ(B-B̄)²)
function znccRgb(
  src: Float32Array,
  srcMean: [number, number, number],
  tmpl: Float32Array,
  tmplMean: [number, number, number],
  n: number,
): number {
  let sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const a = src[i * 3 + c] - srcMean[c];
      const b = tmpl[i * 3 + c] - tmplMean[c];
      sumAB += a * b;
      sumA2 += a * a;
      sumB2 += b * b;
    }
  }
  const denom = Math.sqrt(sumA2 * sumB2);
  return denom === 0 ? 0 : sumAB / denom;
}

export async function matchStage(
  screenshotPath: string,
  mode: Mode,
  imgWidth: number,
  imgHeight: number,
  warn?: WarnLogger,
): Promise<{ stageName: string; score: number }[]> {
  const templates = await loadStageTemplates(mode, warn);
  if (templates.length === 0) return [];

  // テンプレートの幅/高さを基準サイズとして使用（全テンプレートが同サイズ前提）
  const { width: tmplW, height: tmplH } = templates[0];

  // 上 250px 相当をクロップしてテンプレートと同サイズにリサイズ
  const cropTop = Math.round(CROP_TOP_1080 * (imgHeight / 1080));
  const cropH = imgHeight - cropTop;
  const { rgb: srcRgb, mean: srcMean } = await extractRgb(
    screenshotPath,
    cropTop,
    cropH,
    imgWidth,
    tmplW,
    tmplH,
  );

  const n = tmplW * tmplH;
  const ranked: { stageName: string; score: number }[] = [];
  for (const t of templates) {
    ranked.push({
      stageName: t.stageName,
      score: znccRgb(srcRgb, srcMean, t.rgb, t.mean, n),
    });
    // フルサイズ比較は重いため 1 テンプレートごとに yield
    await yieldToEventLoop();
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** テンプレートが存在するモードのステージ名一覧を返す（Replicant 初期化用） */
export function getCachedStageNames(mode: Mode): string[] {
  return (templateCache[mode] ?? []).map((t) => t.stageName);
}
