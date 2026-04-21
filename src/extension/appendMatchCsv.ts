import fs from 'node:fs';
import path from 'node:path';
import { serializeRow } from './csvWrite';
import type { Match, Team, TeamsPool, WeaponAliases } from '../schemas';

const MATCHES_CSV_PATH = path.resolve(process.cwd(), 'data/matches.csv');

const HEADER: string[] = [
  'timestamp',
  'mode',
  'team',
  'p1_weapon',
  'p2_weapon',
  'p3_weapon',
  'p4_weapon',
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

/**
 * teams.csv の players 順にブキ名を並べ替えて返す。
 * プレイヤー名が一致しない場合は空欄。team が不明な場合は OCR 順のまま返す。
 */
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

/**
 * 1 チーム分の行データを返す。
 * 1 試合から alpha/bravo それぞれについて呼び出す。
 */
export function buildTeamRow(
  match: Match,
  side: Match['alpha'],
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
): string[] {
  const team = resolveTeam(pool, match.mode, side.teamId);
  const weapons = sortWeaponsByTeamOrder(side.picks, team, aliases);
  return [
    formatTimestamp(match.timestamp),
    MODE_LABEL[match.mode],
    side.teamId,
    weapons[0] ?? '',
    weapons[1] ?? '',
    weapons[2] ?? '',
    weapons[3] ?? '',
  ];
}

/**
 * `data/matches.csv` に 2 行追記（alpha/bravo 各 1 行）。
 * ファイル不在ならヘッダ付きで新規作成する。
 */
export function appendMatchCsv(
  match: Match,
  pool: TeamsPool | null,
  aliases: WeaponAliases | null,
): void {
  fs.mkdirSync(path.dirname(MATCHES_CSV_PATH), { recursive: true });

  const exists = fs.existsSync(MATCHES_CSV_PATH);
  const alphaRow = buildTeamRow(match, match.alpha, pool, aliases);
  const bravoRow = buildTeamRow(match, match.bravo, pool, aliases);

  const dataLines = serializeRow(alphaRow) + '\r\n' + serializeRow(bravoRow) + '\r\n';
  const payload = exists
    ? dataLines
    : serializeRow(HEADER) + '\r\n' + dataLines;

  fs.appendFileSync(MATCHES_CSV_PATH, payload, 'utf-8');
}
