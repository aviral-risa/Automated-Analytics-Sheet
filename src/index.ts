#!/usr/bin/env node
/**
 * CLI entry — run dashboard sync manually or from cron.
 *
 * Usage:
 *   npm run sync                    # prior weekday → Sheets
 *   npm run sync -- 2026-07-01      # specific date
 *   npm run sync -- rolling         # last N days (config sync.rollingWindowDays)
 *   npm run sync -- rolling 14      # last 14 calendar days
 *   npm run sync -- backfill 2026-07-01 2026-07-07
 */
import 'dotenv/config';
import { syncDashboardForDate, syncRollingWindow, backfillDashboard } from './sync.js';
import { dashboardConfig } from '../config/dashboard.config.js';

async function main(): Promise<void> {
  const arg = process.argv[2];

  console.log('='.repeat(60));
  console.log(`  Sheets Dashboard Kit — ${dashboardConfig.org.displayName}`);
  console.log(`  Org: ${dashboardConfig.org.id}`);
  console.log('='.repeat(60));

  if (arg === 'rolling') {
    const days = Number(process.argv[3] || dashboardConfig.sync.rollingWindowDays);
    await syncRollingWindow(days);
    return;
  }

  if (arg === 'backfill') {
    const start = process.argv[3];
    const end = process.argv[4] ?? start;
    if (!start) {
      throw new Error('Usage: npm run sync -- backfill YYYY-MM-DD [YYYY-MM-DD]');
    }
    await backfillDashboard(start, end);
    return;
  }

  await syncDashboardForDate(arg);
}

main()
  .then(() => console.log('\n✓ Sync completed\n'))
  .catch((err) => {
    console.error('\n❌ Sync failed:', err);
    process.exit(1);
  });
