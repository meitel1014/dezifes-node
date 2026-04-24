import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv';
import type { InGameNames } from '../schemas';

const IN_GAME_NAMES_CSV_PATH = path.resolve(process.cwd(), 'data/in-game-name.csv');

/**
 * data/in-game-name.csv から { 登録名 -> ゲーム内名前 } を構築。
 * ファイルが無い場合は空の Record を返す。
 */
export function loadInGameNamesFromCsv(): InGameNames {
  if (!fs.existsSync(IN_GAME_NAMES_CSV_PATH)) return {};
  const raw = fs.readFileSync(IN_GAME_NAMES_CSV_PATH, 'utf-8');
  const rows = parseCsv(raw);
  if (rows.length === 0) return {};

  const header = rows[0].map((h) => h.trim());
  const playerCol = header.indexOf('プレイヤー名');
  const inGameCol = header.indexOf('ゲーム内の名前');
  if (playerCol < 0 || inGameCol < 0) return {};

  const result: InGameNames = {};
  for (const row of rows.slice(1)) {
    const playerName = (row[playerCol] ?? '').trim();
    const inGameName = (row[inGameCol] ?? '').trim();
    if (playerName === '' || inGameName === '') continue;
    result[playerName] = inGameName;
  }
  return result;
}
