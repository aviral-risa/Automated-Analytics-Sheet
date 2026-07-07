import { google } from 'googleapis';
import { dashboardConfig } from '../config/dashboard.config.js';
import { monthTabName } from './dates.js';

function getSpreadsheetId(): string {
  const envVar = dashboardConfig.googleSheets.spreadsheetIdEnvVar;
  const id = process.env[envVar];
  if (!id) {
    throw new Error(
      `Set ${envVar} in .env to your Google Spreadsheet ID (see config/dashboard.config.ts)`
    );
  }
  return id;
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    throw new Error(
      'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env (service account with Sheets API access)'
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(spreadsheetId: string, title: string, headers: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === title);

  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

function normalizeSheetDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
    return epoch.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, mo, d, y] = mdy;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export interface SummaryRow {
  report_date: string;
  cases_added: number;
  unique_cases_added: number;
  allotted_cases_pct: number;
  non_allotted_mrns: string | null;
  auth_by_risa_count: number;
  nar_count: number;
  auth_pending_count: number;
  denial_count: number;
  first_pass_approval_rate_pct: number;
  denial_value_usd: number;
  total_scans_value_usd: number;
}

export async function upsertSummaryRow(row: SummaryRow): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const tab = monthTabName(row.report_date);
  const headers = [...dashboardConfig.sheetColumns];

  await ensureTab(spreadsheetId, tab, headers);

  const values: (string | number)[] = [
    row.report_date,
    row.cases_added,
    row.unique_cases_added,
    row.allotted_cases_pct,
    row.non_allotted_mrns ?? '',
    row.auth_by_risa_count,
    row.nar_count,
    row.auth_pending_count,
    row.denial_count,
    row.first_pass_approval_rate_pct,
    row.denial_value_usd,
    row.total_scans_value_usd,
    new Date().toISOString(),
  ];

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:A`,
  });
  const existing = response.data.values ?? [];
  let targetRow = -1;
  for (let i = 1; i < existing.length; i++) {
    if (normalizeSheetDate(existing[i]?.[0]) === row.report_date) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  }

  console.log(`  ✓ Wrote ${tab} row for ${row.report_date}`);
}
