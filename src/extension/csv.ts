/**
 * 最小限の RFC4180 準拠 CSV パーサ。
 * - ダブルクォート（`"`）で囲まれたフィールドは、内部のカンマ・改行・`""` エスケープを許容
 * - 非クォートフィールドは単純に次のカンマ/改行まで
 * - 空行は無視
 * - BOM があれば剥がす
 *
 * 外部依存を避けるため自前実装。data/teams.csv 程度（数十行）を想定し、
 * ストリーミングや巨大入力最適化はしない。
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // 空行（1 セルのみで中身が空）は無視
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // エスケープされたダブルクォート
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // \r\n は次ループで \n を処理
      i++;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // 末尾処理
  if (field !== '' || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}
