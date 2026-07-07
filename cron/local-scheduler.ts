/**
 * Local cron runner — keeps sync alive without GitHub Actions.
 *
 * Schedule is read from config/dashboard.config.ts → cron.schedule (IST).
 *
 * Start:  npm run cron
 * Stop:   Ctrl+C
 */
import 'dotenv/config';
import cron from 'node-cron';
import { dashboardConfig } from '../config/dashboard.config.js';
import { syncRollingWindow } from '../src/sync.js';

const { schedule, timezone, description } = dashboardConfig.cron;

console.log('='.repeat(60));
console.log('  Sheets Dashboard Kit — Local Cron');
console.log(`  Org: ${dashboardConfig.org.displayName} (${dashboardConfig.org.id})`);
console.log(`  Schedule: ${schedule} (${timezone})`);
console.log(`  ${description}`);
console.log('='.repeat(60));

async function runJob(): Promise<void> {
  const now = new Date().toLocaleString('en-IN', { timeZone: timezone });
  console.log(`\n⏰ Cron triggered at ${now}`);
  try {
    await syncRollingWindow();
    console.log('✓ Cron job completed\n');
  } catch (err) {
    console.error('❌ Cron job failed:', err);
  }
}

cron.schedule(schedule, () => void runJob(), { timezone });

console.log(`\n✓ Watching for schedule: ${schedule} ${timezone}`);
console.log('  Press Ctrl+C to stop.\n');
