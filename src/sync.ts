import { dashboardConfig } from '../config/dashboard.config.js';
import { runQuery } from './bigquery.js';
import { loadSql } from './sql-loader.js';
import { sumScanValues } from './scan-value.js';
import { getPriorWeekday, isWeekend, datesRollingBack, weekdaysBetween } from './dates.js';
import { upsertSummaryRow } from './sheets.js';

interface DailySummaryRow {
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
}

interface ScanValueRow {
  row_type: string | null;
  regimen_name: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldStore(casesAdded: number, dateStr: string): boolean {
  if (dashboardConfig.cohort.skipWeekends && isWeekend(dateStr)) {
    return false;
  }
  if (dashboardConfig.cohort.requireCasesAdded && casesAdded <= 0) {
    return false;
  }
  return true;
}

export async function syncDashboardForDate(reportDate?: string): Promise<void> {
  const date = reportDate ?? getPriorWeekday();
  const orgId = dashboardConfig.org.id;

  console.log(`\n📊 ${dashboardConfig.org.displayName} — sync for ${date}`);

  const bqParams = { report_date: date, org_id: orgId };

  const [summaryRows, scanRows] = await Promise.all([
    runQuery<DailySummaryRow>(loadSql('daily-summary.sql'), bqParams),
    runQuery<ScanValueRow>(loadSql('cohort-scan-value.sql'), bqParams),
  ]);

  const summary = summaryRows[0];
  if (!summary) {
    throw new Error(`No summary data for ${date}`);
  }

  const casesAdded = Number(summary.cases_added ?? 0);
  if (!shouldStore(casesAdded, date)) {
    console.log(`ℹ️ Skipping ${date} — no cases or weekend`);
    return;
  }

  const denialValue = sumScanValues(scanRows, ['denial']);
  const totalValue = sumScanValues(scanRows, ['auth', 'nar', 'denial']);

  await upsertSummaryRow({
    report_date: date,
    cases_added: casesAdded,
    unique_cases_added: Number(summary.unique_cases_added ?? 0),
    allotted_cases_pct: Number(summary.allotted_cases_pct ?? 0),
    non_allotted_mrns: summary.non_allotted_mrns,
    auth_by_risa_count: Number(summary.auth_by_risa_count ?? 0),
    nar_count: Number(summary.nar_count ?? 0),
    auth_pending_count: Number(summary.auth_pending_count ?? 0),
    denial_count: Number(summary.denial_count ?? 0),
    first_pass_approval_rate_pct: Number(summary.first_pass_approval_rate_pct ?? 0),
    denial_value_usd: denialValue,
    total_scans_value_usd: totalValue,
  });

  console.log(`✓ Done — denial $${denialValue}, processed $${totalValue}`);
}

export async function syncRollingWindow(
  windowDays = dashboardConfig.sync.rollingWindowDays
): Promise<void> {
  const dates = datesRollingBack(windowDays);
  console.log(`\n📊 Rolling re-sync: ${dates.length} weekday(s) in last ${windowDays} days`);

  const delay = dashboardConfig.sync.delayBetweenDatesMs;
  const failures: string[] = [];

  for (const date of dates) {
    try {
      await syncDashboardForDate(date);
      await sleep(delay);
    } catch (err) {
      failures.push(`${date}: ${err}`);
      console.error(`❌ ${date}:`, err);
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

export async function backfillDashboard(startDate: string, endDate: string): Promise<void> {
  const dates = weekdaysBetween(startDate, endDate);
  console.log(`\n📊 Backfill: ${dates.length} weekday(s) from ${startDate} to ${endDate}`);

  const delay = dashboardConfig.sync.delayBetweenDatesMs;
  for (const date of dates) {
    await syncDashboardForDate(date);
    await sleep(delay);
  }
}
