import fs from 'node:fs';
import path from 'node:path';
import { serializeRow } from './csvWrite';
import type { Match, TeamsPool, WeaponAliases } from '../schemas';

const MATCHES_CSV_PATH = path.resolve(process.cwd(), 'data/matches.csv');

const HEADER: string[] = [
  'timestamp',
  'mode',
  'alpha_team',
  'alpha_p1_name',
  'alpha_p1_weapon',
  'alpha_p2_name',
  'alpha_p2_weapon',
  'alpha_p3_name',
  'alpha_p3_weapon',
  'alpha_p4_name',
  'alpha_p4_weapon',
  'bravo_team',
  'bravo_p1_name',
  'bravo_p1_weapon',
  'bravo_p2_name',
  'bravo_p2_weapon',
  'bravo_p3_name',
  'bravo_p3_weapon',
  'bravo_p4_name',
  'bravo_p4_weapon',
  'source_file',
];

const MODE_LABEL: Record<Match['mode'], string> = {
  turfWar: 'ナワバリトーナメント',
  splatZones: 'エリアトーナメント',
};

function resolveTeamName(pool: TeamsPool | null, mode: Match['mode'], teamId: string): string {
  const t = pool?.[mode].find((x) => x.id === teamId);
  return t?.name ?? teamId;
}

function resolveWeapon(aliases: WeaponAliases | null, id: string): string {
  return aliases?.[id] ?? id;
}

/**
 * `data/matches.csv` に 1 行追記。ファイル不在ならヘッダ付きで新規作成する。
 * ブキ名は weaponAliases があれば日本語、無ければ ID のまま書き出す。
 */
export function appendMatchCsv(
  match: Match,
  pool: TeamsPool | null,
  aliases: WeaponAliases | null
): void {
  fs.mkdirSync(path.dirname(MATCHES_CSV_PATH), { recursive: true });

  const exists = fs.existsSync(MATCHES_CSV_PATH);
  const alphaName = resolveTeamName(pool, match.mode, match.alpha.teamId);
  const bravoName = resolveTeamName(pool, match.mode, match.bravo.teamId);

  const row: string[] = [
    match.timestamp,
    MODE_LABEL[match.mode],
    alphaName,
    match.alpha.picks[0].playerName,
    resolveWeapon(aliases, match.alpha.picks[0].weaponId),
    match.alpha.picks[1].playerName,
    resolveWeapon(aliases, match.alpha.picks[1].weaponId),
    match.alpha.picks[2].playerName,
    resolveWeapon(aliases, match.alpha.picks[2].weaponId),
    match.alpha.picks[3].playerName,
    resolveWeapon(aliases, match.alpha.picks[3].weaponId),
    bravoName,
    match.bravo.picks[0].playerName,
    resolveWeapon(aliases, match.bravo.picks[0].weaponId),
    match.bravo.picks[1].playerName,
    resolveWeapon(aliases, match.bravo.picks[1].weaponId),
    match.bravo.picks[2].playerName,
    resolveWeapon(aliases, match.bravo.picks[2].weaponId),
    match.bravo.picks[3].playerName,
    resolveWeapon(aliases, match.bravo.picks[3].weaponId),
    match.sourceFile,
  ];

  const payload = exists
    ? serializeRow(row) + '\r\n'
    : serializeRow(HEADER) + '\r\n' + serializeRow(row) + '\r\n';

  fs.appendFileSync(MATCHES_CSV_PATH, payload, 'utf-8');
}
