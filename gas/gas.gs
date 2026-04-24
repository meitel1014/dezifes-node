const SPREADSHEET_ID = '1S7-MykMe7EjY6Qp3xERrL5X25Zt5B3-5bFixp06iups';

// POST { type: 'record', row: { timestamp, rule, won_team, alpha_team, alpha_p1-p4, bravo_team, bravo_p1-p4 } }
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.type === 'record') return handleRecord(body.row);
  return jsonResponse({ error: 'unknown type: ' + body.type });
}

function handleRecord(row) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('シート1');
  sheet.appendRow([
    row.timestamp, row.rule, row.won_team,
    row.alpha_team, row.alpha_p1, row.alpha_p2, row.alpha_p3, row.alpha_p4,
    row.bravo_team, row.bravo_p1, row.bravo_p2, row.bravo_p3, row.bravo_p4,
  ]);
  return jsonResponse({ ok: true });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
