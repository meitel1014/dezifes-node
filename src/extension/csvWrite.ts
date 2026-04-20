/**
 * RFC4180 に沿った最小の CSV 出力ユーティリティ。
 * カンマ・ダブルクォート・改行を含むセルはダブルクォートで囲み、内部の `"` は `""` にエスケープ。
 * 出力の改行は \r\n（RFC4180 準拠）。
 */
export function serializeCsv(rows: string[][]): string {
  return rows.map(serializeRow).join('\r\n') + '\r\n';
}

export function serializeRow(row: string[]): string {
  return row.map(escapeCell).join(',');
}

function escapeCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}
