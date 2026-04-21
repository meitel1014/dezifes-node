import type { Match, TeamsPool, WeaponAliases } from '../schemas';
import { buildTeamRow } from './appendMatchCsv';

const TIMEOUT_MS = 10_000;

/**
 * GAS Web App に POST して Google スプレッドシートに 2 行追記する（alpha/bravo 各 1 行）。
 * 失敗時は reject する（呼び出し元でログ出力すること）。
 */
export async function appendGoogleSheet(
  match: Match,
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
  endpointUrl: string,
): Promise<void> {
  const toPayload = (row: string[]) => ({
    timestamp: row[0],
    mode: row[1],
    team: row[2],
    p1: row[3],
    p2: row[4],
    p3: row[5],
    p4: row[6],
  });

  const rows = [
    toPayload(buildTeamRow(match, match.alpha, pool, aliases)),
    toPayload(buildTeamRow(match, match.bravo, pool, aliases)),
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
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
