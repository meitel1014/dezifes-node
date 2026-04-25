import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv';
import type { TeamsPool } from '../schemas';
import type { Team } from '../schemas';

const CSV_PATH = path.resolve(process.cwd(), 'data/teams.csv');

/**
 * CSV の列インデックスを日本語ヘッダから解決する。
 * 列順が変わっても追従できるように名前ベースで引く。
 */
const HEADERS = {
  mode: 'ルール',
  name: 'チーム名',
  player1: 'メンバー1の名前',
  player2: 'メンバー2の名前',
  player3: 'メンバー3の名前',
  player4: 'メンバー4の名前',
  alias: '二つ名',
  displayName: 'チーム名(表示用)',
} as const;

const MODE_LABEL_TO_KEY: Record<string, 'turfWar' | 'splatZones'> = {
  ナワバリトーナメント: 'turfWar',
  エリアトーナメント: 'splatZones',
};

/**
 * data/teams.csv を読んで TeamsPool を構築する。
 * ファイルが存在しない場合は空の TeamsPool を返す。
 */
export function loadTeamsPoolFromCsv(): TeamsPool {
  if (!fs.existsSync(CSV_PATH)) {
    return { turfWar: [], splatZones: [] };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(CSV_PATH, 'utf-8');
  } catch (e) {
    console.error(`[loadTeams] Failed to read ${CSV_PATH}:`, e);
    return { turfWar: [], splatZones: [] };
  }
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return { turfWar: [], splatZones: [] };
  }

  const header = rows[0].map((h) => h.trim());
  const idx = {
    mode: header.indexOf(HEADERS.mode),
    name: header.indexOf(HEADERS.name),
    player1: header.indexOf(HEADERS.player1),
    player2: header.indexOf(HEADERS.player2),
    player3: header.indexOf(HEADERS.player3),
    player4: header.indexOf(HEADERS.player4),
    alias: header.indexOf(HEADERS.alias),
    displayName: header.indexOf(HEADERS.displayName),
  };

  const pool: TeamsPool = { turfWar: [], splatZones: [] };

  for (const row of rows.slice(1)) {
    const modeLabel = row[idx.mode]?.trim() ?? '';
    const modeKey = MODE_LABEL_TO_KEY[modeLabel];
    if (!modeKey) continue;

    const rawName = (row[idx.name] ?? '').trim();

    // チーム名が空の行はスキップ
    if (rawName === '') continue;

    const rawDisplayName = idx.displayName >= 0 ? (row[idx.displayName] ?? '').trim() : '';
    const team: Team = {
      id: rawName,
      name: rawDisplayName || rawName,
      alias: (row[idx.alias] ?? '').trim(),
      players: [
        (row[idx.player1] ?? '').trim(),
        (row[idx.player2] ?? '').trim(),
        (row[idx.player3] ?? '').trim(),
        (row[idx.player4] ?? '').trim(),
      ],
    };

    pool[modeKey].push(team);
  }

  return pool;
}
