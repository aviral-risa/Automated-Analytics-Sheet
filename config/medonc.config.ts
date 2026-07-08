/**
 * =============================================================================
 * PLUG & PLAY — MedOnc Alerts Config (one org per deployment)
 * =============================================================================
 *
 * Each MedOnc cron deployment targets exactly ONE organization.
 * Copy this file, set org.id + slack channel, and set MEDONC_ORG_ID in .env.
 *
 * Astera Radiology uses radiology-cron.yml — do NOT use this config for Astera.
 *
 * Quick start:
 *   1. Set org.id below (must match organizations.ts id: nycbs, chc, mbpcc, ucbc, sunstate)
 *   2. Set org.facilityId (Firestore / BigQuery org_id)
 *   3. Copy .env.example → .env and add MEDONC_ORG_ID=<org.id>
 *   4. Add SLACK_WEBHOOK_<ORG_UPPER> and SLACK_BOT_TOKEN to MEDONC_ENV_FILE secret
 *   5. Enable medonc-cron.yml in Cron-Scheduler---Alerts repo
 */

export const medoncConfig = {
  org: {
    /** Short id — must match MEDONC_ORG_ID env and organizations.ts */
    id: 'nycbs',

    /** BigQuery / Firestore org_id (facilityId) */
    facilityId: 'HhwIHO4npKhrxyylkC33',

    displayName: 'NYCBS',

    /** Slack channel for this org's alert images */
    slackChannelId: 'C095RF3PUPQ',
  },

  alerts: {
    /** Mon–Fri 9:00 AM IST — medonc-daily-alerts job */
    dailyAlertsSchedule: '0 9 * * 1-5',

    /** Mon–Fri 9:00 AM IST — open orders + DoS coverage org alerts */
    openOrdersSchedule: '0 9 * * 1-5',

    /** Daily 10:00 PM IST — unworked orders (slack-alerts job) */
    unworkedOrdersSchedule: '0 22 * * *',
  },

  /**
   * Env vars for GitHub secret MEDONC_ENV_FILE (one org per secret):
   *
   *   MEDONC_ORG_ID=nycbs
   *   SLACK_BOT_TOKEN=xoxb-...
   *   SLACK_WEBHOOK_NYCBS=https://hooks.slack.com/services/...
   *   SLACK_CHANNEL_TEST_ALERTS=C0BEP0W1WAK
   *
   * Do not include Astera radiology channels in MedOnc env.
   */
  envTemplate: {
    MEDONC_ORG_ID: 'nycbs',
    SLACK_CHANNEL_TEST_ALERTS: 'C0BEP0W1WAK',
  },
} as const;

export type MedOncConfig = typeof medoncConfig;
