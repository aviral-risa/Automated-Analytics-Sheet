/**
 * IST-aware dispatcher for GitHub Actions (15-minute polling).
 * Copy to scripts/github-dispatch.ts and call from github-actions.yml.
 *
 * Matches cron.schedule from config/dashboard.config.ts within a 14-minute window.
 */
import 'dotenv/config';
import { dashboardConfig } from '../config/dashboard.config.js';
import { syncRollingWindow } from '../src/sync.js';

function getIstMinutesSinceMidnight(reference = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: dashboardConfig.cron.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(reference);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function isDueNow(windowMinutes = 14): boolean {
  const parts = dashboardConfig.cron.schedule.trim().split(/\s+/);
  const minute = parseInt(parts[0] ?? '0', 10);
  const hour = parseInt(parts[1] ?? '0', 10);
  const scheduled = hour * 60 + minute;
  const now = getIstMinutesSinceMidnight();
  const diff = now - scheduled;
  return diff >= 0 && diff < windowMinutes;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  if (!force && !isDueNow()) {
    console.log('No dashboard sync due in this 15-minute window.');
    return;
  }

  console.log(`▶ Running rolling sync for ${dashboardConfig.org.displayName}`);
  await syncRollingWindow();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
