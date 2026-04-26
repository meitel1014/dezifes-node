/**
 * 全チームのチーム名画像を一括エクスポートするスタンドアロンスクリプト。
 * NodeCG・Replicant に依存せず、data/teams.csv を直接読む。
 *
 * 実行: node scripts/export-images.mjs
 *       または: pnpm run export-images
 *
 * 要件: インターネット接続（Adobe Typekit + Google Fonts の CDN 読み込み）
 *
 * 出力: dump/
 *   Name-Team_VS-under/{ナワバリ|エリア}/{team.id}.png        960×70
 *   Name-Team_VS-side/{ナワバリ|エリア}/{アルファ|ブラボー}/{team.id}.png  960×1080
 *
 * ─── メンテナンスガイド ────────────────────────────────────────────────────────
 * ✅ 自動反映（スクリプト修正不要）:
 *   - CSS の変更（色・サイズ・レイアウト等）
 *       → UNDER_CSS / SIDE_CSS を実行時に readFileSync で読み込むため自動反映
 *   - チームデータ変更（data/teams.csv）
 *       → 実行のたびに最新の CSV を読み込む
 *
 * ❌ 手動での同期が必要:
 *   - Shadow パラメータ
 *       → 参照元: src/browser/graphics/_shared/UnderGraphic.tsx の const SHADOW
 *                  src/browser/graphics/_shared/SideGraphic.tsx の const SHADOW
 *       → このファイル内の buildUnderHtml / buildSideHtml の buildSvgFilter 呼び出し引数を更新
 *   - FitText のスケール計算ロジック
 *       → 参照元: src/browser/components/FitText.tsx の useEffect 内
 *       → このファイル内の buildSideHtml の <script> ブロックを更新
 *   - HTML の要素構造（新要素追加・削除）
 *       → 参照元: UnderGraphic.tsx / SideGraphic.tsx の TeamSlot コンポーネントの return
 *       → buildUnderHtml / buildSideHtml の HTML テンプレート部分を更新
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

// ─── パス解決 ──────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const DUMP_DIR = path.join(PROJECT_ROOT, 'dump');

// ─── CSS（実行時に読み込み。under.css / side.css の変更は自動反映） ───────────────

// 参照元: src/browser/graphics/_shared/under.css
const UNDER_CSS = readFileSync(
  path.join(SRC_ROOT, 'browser/graphics/_shared/under.css'),
  'utf-8',
);

// 参照元: src/browser/graphics/_shared/side.css
const SIDE_CSS = readFileSync(
  path.join(SRC_ROOT, 'browser/graphics/_shared/side.css'),
  'utf-8',
);

// 参照元: src/browser/global.css
// 実際の NodeCG ページでは global.css が読み込まれ、* { box-sizing: border-box } が
// .side-slot にも適用される。これにより height:1080px + padding-bottom:250px の
// content area が 830px になる（content-box では 1080px になりずれが生じる）
const GLOBAL_CSS = readFileSync(
  path.join(SRC_ROOT, 'browser/global.css'),
  'utf-8',
);

// ─── CSV パーサ（src/extension/csv.ts の移植） ────────────────────────────────

function parseCsv(input) {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    if (row.length === 1 && row[0] === '') { row = []; return; }
    rows.push(row); row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { pushField(); pushRow(); i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }
  return rows;
}

// ─── チームローダー（src/extension/loadTeams.ts の移植） ──────────────────────

// 参照元: src/extension/loadTeams.ts の HEADERS / MODE_LABEL_TO_KEY
const HEADERS = {
  mode:        'ルール',
  name:        'チーム名',
  player1:     'メンバー1の名前',
  player2:     'メンバー2の名前',
  player3:     'メンバー3の名前',
  player4:     'メンバー4の名前',
  alias:       '二つ名',
  displayName: 'チーム名(表示用)',
};

const MODE_LABEL_TO_KEY = {
  ナワバリトーナメント: 'turfWar',
  エリアトーナメント:   'splatZones',
};

function loadTeams() {
  const csvPath = path.join(PROJECT_ROOT, 'data/teams.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(raw);
  if (rows.length === 0) return { turfWar: [], splatZones: [] };

  const header = rows[0].map(h => h.trim());
  const idx = Object.fromEntries(
    Object.entries(HEADERS).map(([k, v]) => [k, header.indexOf(v)]),
  );

  const pool = { turfWar: [], splatZones: [] };

  for (const row of rows.slice(1)) {
    const modeLabel = row[idx.mode]?.trim() ?? '';
    const modeKey = MODE_LABEL_TO_KEY[modeLabel];
    if (!modeKey) continue;

    const rawName = (row[idx.name] ?? '').trim();
    if (!rawName) continue;

    const rawDisplayName = idx.displayName >= 0 ? (row[idx.displayName] ?? '').trim() : '';
    pool[modeKey].push({
      id:      rawName,
      name:    rawDisplayName || rawName,
      alias:   (row[idx.alias]   ?? '').trim(),
      players: [
        (row[idx.player1] ?? '').trim(),
        (row[idx.player2] ?? '').trim(),
        (row[idx.player3] ?? '').trim(),
        (row[idx.player4] ?? '').trim(),
      ],
    });
  }

  return pool;
}

// ─── HTML 生成ユーティリティ ───────────────────────────────────────────────────

// 参照元: src/browser/utils/stripHtml.ts
const stripHtml = html => html.replace(/<[^>]*>/g, '');

// 参照元: src/browser/graphics/_shared/ShadowFilters.tsx の feXxx フィルター構成
function buildSvgFilter(id, color, opacity, dilate, dx, dy, blur) {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feFlood flood-color="${color}" flood-opacity="${opacity}" result="color"/>
      <feMorphology in="SourceAlpha" operator="dilate" radius="${dilate}" result="spread"/>
      <feOffset in="spread" dx="${dx}" dy="${dy}" result="shifted"/>
      <feGaussianBlur in="shifted" stdDeviation="${blur}" result="blurred"/>
      <feComposite in="color" in2="blurred" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

/**
 * CSS 内の @import を先頭に抽出して <style> を組み立てる。
 * CSS 仕様上 @import は他のルールより前になければならないため、
 * body { background: transparent } を入れる位置に注意が必要。
 *
 * Typekit kit ID の参照元: src/template.html
 * pageHeight: position:absolute なスロットの基準となる html/body の高さ（NodeCG 環境を再現）
 */
function buildHead(cssText, pageHeight) {
  const importLines = [];
  const otherLines = [];
  for (const line of cssText.split('\n')) {
    (line.trim().startsWith('@import') ? importLines : otherLines).push(line);
  }
  // html/body を正確な高さで固定することで、position:absolute なスロットが
  // NodeCG 実行時と同じ initial containing block（ビューポート）を基準に配置される
  // GLOBAL_CSS（* { box-sizing: border-box }）を先に適用することで、
  // .side-slot の content area が NodeCG 実行時と同一になる
  const css = [
    ...importLines,
    `html, body { margin: 0; height: ${pageHeight}px; overflow: hidden; background: transparent; }`,
    GLOBAL_CSS,
    ...otherLines,
  ].join('\n');

  return `<head>
<meta charset="UTF-8">
<script>(function(d){
  var config={kitId:'cuj4ylh',scriptTimeout:8000,async:true},
  h=d.documentElement,
  t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),
  tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;
  h.className+=" wf-loading";
  tk.src='https://use.typekit.net/'+config.kitId+'.js';
  tk.async=true;
  tk.onload=tk.onreadystatechange=function(){
    a=this.readyState;
    if(f||a&&a!="complete"&&a!="loaded")return;
    f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}
  };
  s.parentNode.insertBefore(tk,s);
})(document);</script>
<style>
${css}
</style>
</head>`;
}

// ─── under HTML ────────────────────────────────────────────────────────────────
//
// 参照元（HTML 構造）: src/browser/graphics/_shared/UnderGraphic.tsx の TeamSlot
// 参照元（表示内容）:
//   チーム名 → stripHtml(team.name)  ← UnderGraphic.tsx L19
//   プレイヤー → team.players.join('　')  ← UnderGraphic.tsx L20

function buildUnderHtml(team) {
  // SHADOW 参照元: src/browser/graphics/_shared/UnderGraphic.tsx の const SHADOW
  // SHADOW.dx = 0 なので shadow-alpha と shadow-bravo は同一パラメータ
  // CSS が .under-alpha に filter: url(#shadow-alpha) を自動適用するため ID を合わせる
  const filter = buildSvgFilter('shadow-alpha', 'rgb(43,43,43)', 0.7, 4, 0, 2, 2);

  return `<!DOCTYPE html><html>
${buildHead(UNDER_CSS, 70)}
<body>
<svg width="0" height="0" style="position:absolute"><defs>
  ${filter}
</defs></svg>
<!-- under-alpha: position:absolute; bottom:0 をそのまま使用（html/body の height:70px が基準） -->
<!-- CSS の filter:url(#shadow-alpha) が自動適用される -->
<div class="under-slot under-alpha">
  <div class="under-team-name">${stripHtml(team.name)}</div>
  <div class="under-players">${team.players.join('　')}</div>
</div>
</body></html>`;
}

// ─── side HTML ─────────────────────────────────────────────────────────────────
//
// 参照元（HTML 構造）: src/browser/graphics/_shared/SideGraphic.tsx
//   SideGraphic: .side-container → .side-slot.side-alpha + .side-slot.side-bravo
//   TeamSlot: .side-slot → .side-team-content → alias / team-name / players
//
// 参照元（表示内容）:
//   alias → team.alias を innerHTML として描画  ← Html コンポーネント相当
//   チーム名 → team.name を innerHTML + FitText スケール  ← FitText コンポーネント相当
//   プレイヤー → team.players.map() で各行  ← SideGraphic.tsx
//
// ビューポートは 1920×1080 でレンダリングし、alpha/bravo は clip で切り出す:
//   alpha: clip { x:0,   y:0, width:960, height:1080 }
//   bravo: clip { x:960, y:0, width:960, height:1080 }

function buildSideHtml(team, side) {
  // SHADOW 参照元: src/browser/graphics/_shared/SideGraphic.tsx の const SHADOW
  // dx の符号: ShadowFilters.tsx の sides 配列
  //   [{ id: 'shadow-alpha', dx: -shadow.dx }, { id: 'shadow-bravo', dx: shadow.dx }]
  //   SHADOW.dx = 6 → alpha: dx=-6, bravo: dx=+6
  // .side-container に両スロットが存在するため両方のフィルターを定義する
  const filterAlpha = buildSvgFilter('shadow-alpha', 'rgb(94,94,94)', 0.6, 6, -6, 10, 4);
  const filterBravo = buildSvgFilter('shadow-bravo', 'rgb(94,94,94)', 0.6, 6,  6, 10, 4);

  // FitText の align prop → transformOrigin の対応
  //   align='left'  → 'left top'   （alpha）
  //   align='right' → 'right top'  （bravo）
  // 参照元: src/browser/components/FitText.tsx
  const fitOrigin = side === 'alpha' ? 'left top' : 'right top';

  // チームコンテンツは対象サイドのスロットにのみ配置する（もう片方は空）
  const slotContent = `
    <div class="side-team-content">

      <!-- alias: Html コンポーネント相当（team.alias を innerHTML として扱う） -->
      <div class="side-alias">${team.alias}</div>

      <!-- FitText 参照元: src/browser/components/FitText.tsx の useEffect ロジック -->
      <!-- FitText.tsx のスケール計算が変わった場合は下の <script> ブロックも更新すること -->
      <div class="side-team-name" id="fit-container">
        <span id="fit-inner" style="display:inline-block;white-space:nowrap">${team.name}</span>
      </div>

      <!-- players: team.players.map() 相当 -->
      <div class="side-players">
        ${team.players.map(p => `<div class="side-player">${p}</div>`).join('\n        ')}
      </div>

    </div>`;

  return `<!DOCTYPE html><html>
${buildHead(SIDE_CSS, 1080)}
<body>
<svg width="0" height="0" style="position:absolute"><defs>
  ${filterAlpha}
  ${filterBravo}
</defs></svg>
<!-- 実際の NodeCG HTML 構造を完全再現: .side-container → .side-slot × 2 -->
<!-- ビューポートは 1920×1080、スクリーンショット時に clip で片側 960×1080 を切り出す -->
<div class="side-container">
  <div class="side-slot side-alpha">
    ${side === 'alpha' ? slotContent : ''}
  </div>
  <div class="side-slot side-bravo">
    ${side === 'bravo' ? slotContent : ''}
  </div>
</div>
<script>
(function() {
  // FitText vanilla JS 実装 — src/browser/components/FitText.tsx の useEffect を移植
  var container = document.getElementById('fit-container');
  var inner = document.getElementById('fit-inner');
  if (!container || !inner) {
    document.body.setAttribute('data-fit-done', '1');
    return;
  }
  inner.style.transform = 'none';
  container.style.height = 'auto';
  requestAnimationFrame(function() {
    var cw = inner.scrollWidth, aw = container.clientWidth;
    var ch = inner.scrollHeight;
    var ah = container.parentElement ? container.parentElement.clientHeight : 0;
    var s = 1;
    if (cw > aw && cw > 0) s = Math.min(s, aw / cw);
    if (ah > 0 && ch > ah) s = Math.min(s, ah / ch);
    inner.style.transform = 'scale(' + s + ')';
    inner.style.transformOrigin = '${fitOrigin}';
    container.style.height = (ch * s) + 'px';
    // Puppeteer の waitForFunction でポーリングするための完了フラグ
    document.body.setAttribute('data-fit-done', '1');
  });
})();
</script>
</body></html>`;
}

// ─── Puppeteer スクリーンショット ──────────────────────────────────────────────
//
// viewport: ブラウザウィンドウサイズ（レイアウト計算の基準）
// clip:     実際に切り出す矩形（viewport の一部でも全体でも可）
//   side の場合: viewport=1920×1080、clip で alpha(x:0) / bravo(x:960) を切り出す

async function capture(page, html, viewport, clip, hasFitText = false) {
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  // domcontentloaded で DOM 構築完了まで待つ
  // （networkidle0 は Typekit の非同期リクエストでタイムアウトするため使わない）
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  // CSS Font Loading API: フォントのパース・適用完了を保証
  await page.evaluate(() => document.fonts.ready);
  // Typekit が DOM に wf-active / wf-inactive を付与するまで待機
  await page.waitForFunction(
    () => document.documentElement.classList.contains('wf-active')
       || document.documentElement.classList.contains('wf-inactive'),
    { timeout: 10000 },
  );
  if (hasFitText) {
    // FitText の requestAnimationFrame コールバック完了を待つ
    await page.waitForFunction(
      () => document.body.getAttribute('data-fit-done') === '1',
      { timeout: 5000 },
    );
  }
  // CSS rotate のレイアウト再計算完了余裕（RAF は ~16ms/フレーム）
  await new Promise(r => setTimeout(r, 150));
  return page.screenshot({
    omitBackground: true,
    type: 'png',
    clip,
  });
}

// ─── メイン ───────────────────────────────────────────────────────────────────

const RULE_LABEL = { turfWar: 'ナワバリ', splatZones: 'エリア' };
const SIDE_LABEL = { alpha: 'アルファ', bravo: 'ブラボー' };

async function main() {
  const teams = loadTeams();
  const totalTeams = Object.values(teams).reduce((n, arr) => n + arr.length, 0);
  console.log(`チーム数: ナワバリ=${teams.turfWar.length}, エリア=${teams.splatZones.length}`);
  console.log(`出力先: ${DUMP_DIR}\n`);

  // --no-sandbox: WSL2 / Docker 環境では必須
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  let done = 0;

  try {
    for (const [rule, list] of Object.entries(teams)) {
      for (const team of list) {
        // under（viewport:960×70、clip:(0,0,960,70)）
        const underDir = path.join(DUMP_DIR, 'Name-Team_VS-under', RULE_LABEL[rule]);
        mkdirSync(underDir, { recursive: true });
        const underBuf = await capture(
          page, buildUnderHtml(team),
          { width: 960, height: 70 },
          { x: 0, y: 0, width: 960, height: 70 },
          false,
        );
        writeFileSync(path.join(underDir, `${team.id}.png`), underBuf);

        // side alpha / bravo
        // viewport:1920×1080 でレンダリングし、clip で片側 960×1080 を切り出す
        // alpha: x:0、bravo: x:960
        for (const side of ['alpha', 'bravo']) {
          const clipX = side === 'alpha' ? 0 : 960;
          const sideDir = path.join(
            DUMP_DIR, 'Name-Team_VS-side', RULE_LABEL[rule], SIDE_LABEL[side],
          );
          mkdirSync(sideDir, { recursive: true });
          const sideBuf = await capture(
            page, buildSideHtml(team, side),
            { width: 1920, height: 1080 },
            { x: clipX, y: 0, width: 960, height: 1080 },
            true,
          );
          writeFileSync(path.join(sideDir, `${team.id}.png`), sideBuf);
        }

        done++;
        console.log(`[${done}/${totalTeams}] ${RULE_LABEL[rule]} / ${team.id}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✓ 完了 → ${DUMP_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
