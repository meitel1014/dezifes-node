const SPREADSHEET_ID = '1S7-MykMe7EjY6Qp3xERrL5X25Zt5B3-5bFixp06iups';

function doPost(e) {
  const path = e.pathInfo;
  if (path === 'weapons') return handleWeapons(e);
  if (path === 'result') return handleResult(e);
  return jsonResponse({ error: 'unknown path: ' + path }, 404);
}

// POST /weapons  { rows: [{ timestamp, mode, team, p1, p2, p3, p4 }] }
function handleWeapons(e) {
  const { rows } = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('シート1');
  rows.forEach(r => {
    sheet.appendRow([r.timestamp, r.mode, r.team, r.p1, r.p2, r.p3, r.p4]);
  });
  return jsonResponse({ ok: true });
}

// POST /result  { row: { timestamp, mode, alpha_team, bravo_team, won_team } }
function handleResult(e) {
  const { row } = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('シート2');
  sheet.appendRow([row.timestamp, row.mode, row.alpha_team, row.bravo_team, row.won_team]);
  return jsonResponse({ ok: true });
}

function jsonResponse(data, status) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
