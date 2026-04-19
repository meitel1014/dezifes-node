import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv';
import { serializeCsv } from './csvWrite';
import type { WeaponAliases } from '../schemas';

const ALIASES_CSV_PATH = path.resolve(process.cwd(), 'data/weapon_aliases.csv');
const WEAPON_IMG_DIR = path.resolve(process.cwd(), 'data/weapon_flat_10_0_0');

const HEADER = ['id', 'ja'] as const;

/**
 * data/weapon_flat_10_0_0/ 内の PNG から weapon ID の一覧を返す。
 * ID = ファイル名から `.png` を落としたもの（例: `Path_Wst_Blaster_Middle_00`）。
 */
export function listWeaponIds(): string[] {
  if (!fs.existsSync(WEAPON_IMG_DIR)) return [];
  return fs
    .readdirSync(WEAPON_IMG_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => f.replace(/\.png$/i, ''))
    .sort();
}

/**
 * data/weapon_aliases.csv から { id -> ja } を構築。
 * ファイルが無い場合は空の Record を返す（運用者が未準備の段階）。
 */
export function loadWeaponAliasesFromCsv(): WeaponAliases {
  if (!fs.existsSync(ALIASES_CSV_PATH)) return {};
  const raw = fs.readFileSync(ALIASES_CSV_PATH, 'utf-8');
  const rows = parseCsv(raw);
  if (rows.length === 0) return {};

  const header = rows[0].map((h) => h.trim());
  const idCol = header.indexOf(HEADER[0]);
  const jaCol = header.indexOf(HEADER[1]);
  if (idCol < 0 || jaCol < 0) return {};

  const aliases: WeaponAliases = {};
  for (const row of rows.slice(1)) {
    const id = (row[idCol] ?? '').trim();
    const ja = (row[jaCol] ?? '').trim();
    if (id === '' || ja === '') continue;
    aliases[id] = ja;
  }
  return aliases;
}

/**
 * 対応表 CSV のひな型を生成。既存ファイルがあれば ja 列を温存しつつ未登録 ID を追記し、
 * weapon_flat_10_0_0/ に無くなった ID は残さない（ディレクトリが正とする）。
 */
export function generateWeaponAliasesCsv(): { added: number; total: number } {
  const existing = loadWeaponAliasesFromCsv();
  const ids = listWeaponIds();

  let added = 0;
  const rows: string[][] = [[...HEADER]];
  for (const id of ids) {
    const ja = existing[id] ?? '';
    if (!(id in existing)) added++;
    rows.push([id, ja]);
  }

  fs.mkdirSync(path.dirname(ALIASES_CSV_PATH), { recursive: true });
  fs.writeFileSync(ALIASES_CSV_PATH, serializeCsv(rows), 'utf-8');
  return { added, total: ids.length };
}
