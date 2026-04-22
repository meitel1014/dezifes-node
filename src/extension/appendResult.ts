import fs from 'node:fs';
import path from 'node:path';
import { serializeRow } from './csvWrite';
import type { ActiveMode, Selection } from '../schemas';

const RESULTS_CSV_PATH = path.resolve(process.cwd(), 'data/results.csv');
const TIMEOUT_MS = 10_000;

const HEADER: string[] = [
  'timestamp',
  'mode',
  'alpha_team',
  'bravo_team',
  'won_team',
];

const JST_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function createTimestamp(): string {
  return JST_FORMATTER.format(new Date());
}

const MODE_LABEL: Record<ActiveMode, string> = {
  'turfWar': 'ナワバリトーナメント',
  'splatZones': 'エリアトーナメント',
};

/**
 * 試合結果報告の形式の行を生成する。
 */
export function buildResultRow(
  selected: Selection,
  mode: ActiveMode,
  result: string
): string[] {
  if (selected[mode].alpha === null || selected[mode].bravo === null) {
    throw new Error('Some teams are not selected');
  } else {
    const alpha: string = selected[mode].alpha;
    const bravo: string = selected[mode].bravo;
    const result_base: string[] = [createTimestamp(), MODE_LABEL[mode], alpha, bravo];
    result_base.push(result === 'alpha_win' ? alpha : bravo);

    return result_base;
  }
}

/**
 * `data/matches.csv` に 2 行追記（alpha/bravo 各 1 行）。
 * ファイル不在ならヘッダ付きで新規作成する。
 */
export function appendResultCsv(
  selected: Selection,
  mode: ActiveMode,
  result: string
): void {
  fs.mkdirSync(path.dirname(RESULTS_CSV_PATH), { recursive: true });

  const exists = fs.existsSync(RESULTS_CSV_PATH);
  const row = buildResultRow(selected, mode, result);
  const dataLines = serializeRow(row) + '\r\n';

  const payload = exists
    ? dataLines
    : serializeRow(HEADER) + '\r\n' + dataLines;

  fs.appendFileSync(RESULTS_CSV_PATH, payload, 'utf-8');
}

/**
 * GAS Web App に POST して Google スプレッドシートに 1 行追記する。
 * 失敗時は reject する（呼び出し元でログ出力すること）。
 */
export async function appendResultGoogleSheet(
  selected: Selection,
  mode: ActiveMode,
  result: string,
  endpointUrl: string,
): Promise<void> {
  const toPayload = (row: string[]) => ({
    timestamp: row[0],
    mode: row[1],
    alpha_team: row[2],
    bravo_team: row[3],
    won_team: row[4],
  });

  const row = toPayload(buildResultRow(selected, mode, result));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpointUrl + '/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GAS returned HTTP ${res.status}`);
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`GAS request timed out after ${TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
