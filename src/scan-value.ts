import { dashboardConfig } from '../config/dashboard.config.js';

export function scanValueFromRegimen(regimenName: string | null | undefined): number {
  const name = (regimenName ?? '').trim();
  if (!name) {
    return 0;
  }
  for (const rate of dashboardConfig.scanValueRates) {
    const re = new RegExp(rate.pattern, rate.flags);
    if (re.test(name)) {
      return rate.value;
    }
  }
  return 0;
}

export function sumScanValues(
  rows: Array<{ row_type: string | null; regimen_name: string | null }>,
  types: string[]
): number {
  return rows
    .filter((r) => r.row_type && types.includes(r.row_type))
    .reduce((sum, r) => sum + scanValueFromRegimen(r.regimen_name), 0);
}
