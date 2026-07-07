import { dashboardConfig } from '../config/dashboard.config.js';

const tz = dashboardConfig.timezone;

export function todayInTimezone(reference = new Date()): string {
  return reference.toLocaleDateString('en-CA', { timeZone: tz });
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  return day === 'Sat' || day === 'Sun';
}

/** Prior IST weekday (skips weekends only — simple default for plug-and-play) */
export function getPriorWeekday(reference = new Date()): string {
  const cursor = new Date(reference);
  for (let i = 0; i < 14; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const iso = cursor.toLocaleDateString('en-CA', { timeZone: tz });
    if (!isWeekend(iso)) {
      return iso;
    }
  }
  return cursor.toLocaleDateString('en-CA', { timeZone: tz });
}

export function weekdaysBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) {
    const iso = cursor.toLocaleDateString('en-CA', { timeZone: tz });
    if (!isWeekend(iso)) {
      dates.push(iso);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function datesRollingBack(calendarDays: number, reference = new Date()): string[] {
  const dates: string[] = [];
  const cursor = new Date(reference);
  for (let i = 0; i < calendarDays; i++) {
    const iso = cursor.toLocaleDateString('en-CA', { timeZone: tz });
    if (!isWeekend(iso)) {
      dates.push(iso);
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
}

export function monthTabName(reportDate: string): string {
  const [year, month] = reportDate.split('-');
  return `${year}-${month}_${dashboardConfig.googleSheets.tabSuffix}`;
}

export function nowTimestamp(): string {
  return new Date().toLocaleString('en-IN', { timeZone: tz });
}
