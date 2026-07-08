import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dashboardConfig } from '../config/dashboard.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_ROOT = resolve(__dirname, '../sql');

function sqlQuoteList(values: readonly string[]): string {
  return values.map((v) => `'${v.toLowerCase().replace(/'/g, "''")}'`).join(', ');
}

function bqTable(table: string): string {
  const { projectId, dataset } = dashboardConfig.bigquery;
  return `${projectId}.${dataset}.${table}`;
}

/** Inject config values into SQL template placeholders */
export function loadSql(fileName: string): string {
  const raw = readFileSync(resolve(SQL_ROOT, fileName), 'utf8');
  const { bigquery, timezone, statuses, assignment, sync } = dashboardConfig;

  const replacements: Record<string, string> = {
    '{{BQ_TABLE_ORDER}}': bqTable(bigquery.tables.order),
    '{{BQ_TABLE_ORDER_STATUS}}': bqTable(bigquery.tables.orderStatus),
    '{{BQ_TABLE_DEMOGRAPHICS}}': bqTable(bigquery.tables.demographics),
    '{{BQ_TABLE_AUTH_COMMENTS}}': bqTable(bigquery.tables.authComments),
    '{{TIMEZONE}}': timezone,
    '{{UNIQUE_LOOKBACK_DAYS}}': String(sync.uniqueLookbackDays ?? 30),
    '{{AUTHORIZED_STATUSES_SQL}}': sqlQuoteList(statuses.authorized),
    '{{NAR_STATUSES_SQL}}': sqlQuoteList(statuses.nar),
    '{{PENDING_STATUSES_SQL}}': sqlQuoteList(statuses.pending),
    '{{DENIED_STATUSES_SQL}}': sqlQuoteList(statuses.denied),
    '{{DENIAL_COMMENT_TYPES_SQL}}': sqlQuoteList(statuses.denialCommentTypes),
    '{{UNASSIGNED_LABELS_SQL}}': sqlQuoteList(assignment.unassignedLabels),
  };

  let sql = raw;
  for (const [token, value] of Object.entries(replacements)) {
    sql = sql.split(token).join(value);
  }
  return sql;
}
