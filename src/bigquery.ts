import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { dashboardConfig } from '../config/dashboard.config.js';

let client: BigQuery | null = null;

function getCredentials():
  | { client_email: string; private_key: string }
  | undefined {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.BIGQUERY_KEY_FILE;
  if (keyFile && existsSync(keyFile)) {
    const key = JSON.parse(readFileSync(keyFile, 'utf8')) as {
      client_email?: string;
      private_key?: string;
    };
    if (key.client_email && key.private_key) {
      return { client_email: key.client_email, private_key: key.private_key };
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (email && privateKey) {
    return { client_email: email, private_key: privateKey };
  }

  return undefined;
}

function getClient(): BigQuery {
  if (!client) {
    const projectId =
      process.env.BIGQUERY_PROJECT_ID || dashboardConfig.bigquery.projectId;
    const credentials = getCredentials();
    client = credentials
      ? new BigQuery({ projectId, credentials })
      : new BigQuery({ projectId });
  }
  return client;
}

export async function runQuery<T extends Record<string, unknown>>(
  sql: string,
  params: Record<string, unknown>
): Promise<T[]> {
  const bq = getClient();
  const [rows] = await bq.query({ query: sql, params, location: 'US' });
  return rows as T[];
}
