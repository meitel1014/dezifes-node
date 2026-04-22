const SPREADSHEET_ID = '1S7-MykMe7EjY6Qp3xERrL5X25Zt5B3-5bFixp06iups';

// POST  { type: 'weapons', rows: [{ timestamp, mode, team, p1, p2, p3, p4 }] }
// POST  { type: 'result',  row:  { timestamp, mode, alpha_team, bravo_team, won_team } }
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.type === 'weapons') return handleWeapons(body.rows);
  if (body.type === 'result')  return handleResult(body.row);
  return jsonResponse({ error: 'unknown type: ' + body.type });
}

function handleWeapons(rows) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('シート1');
  rows.forEach(r => {
    sheet.appendRow([r.timestamp, r.mode, r.team, r.p1, r.p2, r.p3, r.p4]);
  });
  return jsonResponse({ ok: true });
}

function handleResult(row) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('シート2');
  sheet.appendRow([row.timestamp, row.mode, row.alpha_team, row.bravo_team, row.won_team]);
  return jsonResponse({ ok: true });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
