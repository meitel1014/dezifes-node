import fs from 'node:fs';
import path from 'node:path';
import { serializeRow } from './csvWrite';
import type { Match, Team, TeamsPool, WeaponAliases } from '../schemas';

const RECORDS_CSV_PATH = path.resolve(process.cwd(), 'data/records.csv');
const TIMEOUT_MS = 10_000;

const HEADER: string[] = [
  'timestamp',
  'rule',
  'stage',
  'won_team',
  'alpha_team',
  'alpha_p1',
  'alpha_p2',
  'alpha_p3',
  'alpha_p4',
  'bravo_team',
  'bravo_p1',
  'bravo_p2',
  'bravo_p3',
  'bravo_p4',
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

function formatTimestamp(isoString: string): string {
  return JST_FORMATTER.format(new Date(isoString));
}

const MODE_LABEL: Record<Match['mode'], string> = {
  turfWar: 'ナワバリトーナメント',
  splatZones: 'エリアトーナメント',
};

function resolveTeam(pool: TeamsPool | null, mode: Match['mode'], teamId: string): Team | undefined {
  return pool?.[mode].find((x) => x.id === teamId);
}

function resolveWeapon(aliases: WeaponAliases | null, id: string): string {
  if (!id) return '';
  return aliases?.[id] ?? id;
}

/** teams.csv の players 順にブキ名を並べ替えて返す。名前不一致は空欄、チーム不明は OCR 順。 */
function sortWeaponsByTeamOrder(
  picks: Match['alpha']['picks'],
  team: Team | undefined,
  aliases: WeaponAliases | null,
): string[] {
  if (!team) {
    return picks.map((p) => resolveWeapon(aliases, p.weaponId));
  }
  return team.players.map((csvName) => {
    const pick = picks.find((p) => p.playerName === csvName);
    return pick ? resolveWeapon(aliases, pick.weaponId) : '';
  });
}

function buildSideWeapons(
  side: Match['alpha'],
  mode: Match['mode'],
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
): { teamName: string; weapons: string[] } {
  const team = resolveTeam(pool, mode, side.teamId);
  return {
    teamName: team?.name ?? side.teamId,
    weapons: sortWeaponsByTeamOrder(side.picks, team, aliases),
  };
}

/** 1 試合分の統合行データを返す。 */
export function buildRecordRow(
  match: Match,
  wonSide: 'alpha' | 'bravo',
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
): string[] {
  const alpha = buildSideWeapons(match.alpha, match.mode, pool, aliases);
  const bravo = buildSideWeapons(match.bravo, match.mode, pool, aliases);
  const wonTeamName = wonSide === 'alpha' ? alpha.teamName : bravo.teamName;
  return [
    formatTimestamp(match.timestamp),
    MODE_LABEL[match.mode],
    match.stageName ?? '',
    wonTeamName,
    alpha.teamName,
    alpha.weapons[0] ?? '',
    alpha.weapons[1] ?? '',
    alpha.weapons[2] ?? '',
    alpha.weapons[3] ?? '',
    bravo.teamName,
    bravo.weapons[0] ?? '',
    bravo.weapons[1] ?? '',
    bravo.weapons[2] ?? '',
    bravo.weapons[3] ?? '',
  ];
}

/** `data/records.csv` に 1 行追記。ファイル不在ならヘッダ付きで新規作成する。 */
export function appendRecordCsv(
  match: Match,
  wonSide: 'alpha' | 'bravo',
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
): void {
  fs.mkdirSync(path.dirname(RECORDS_CSV_PATH), { recursive: true });

  const exists = fs.existsSync(RECORDS_CSV_PATH);
  const row = buildRecordRow(match, wonSide, pool, aliases);
  const dataLine = serializeRow(row) + '\r\n';
  const payload = exists ? dataLine : serializeRow(HEADER) + '\r\n' + dataLine;

  fs.appendFileSync(RECORDS_CSV_PATH, payload, 'utf-8');
}

/**
 * GAS Web App に POST して Google スプレッドシートに 1 行追記する。
 * 失敗時は reject する（呼び出し元でログ出力すること）。
 */
export async function appendRecordGoogleSheet(
  match: Match,
  wonSide: 'alpha' | 'bravo',
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
  endpointUrl: string,
): Promise<void> {
  const row = buildRecordRow(match, wonSide, pool, aliases);
  const payload = {
    type: 'record',
    row: {
      timestamp: row[0],
      rule: row[1],
      stage: row[2],
      won_team: row[3],
      alpha_team: row[4],
      alpha_p1: row[5],
      alpha_p2: row[6],
      alpha_p3: row[7],
      alpha_p4: row[8],
      bravo_team: row[9],
      bravo_p1: row[10],
      bravo_p2: row[11],
      bravo_p3: row[12],
      bravo_p4: row[13],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
