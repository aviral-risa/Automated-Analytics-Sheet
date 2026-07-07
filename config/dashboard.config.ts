/**
 * =============================================================================
 * PLUG & PLAY — Google Sheets Daily Dashboard Config
 * =============================================================================
 *
 * Edit this file to adapt the dashboard for a new org or workflow.
 * No source-code changes are required for most setups.
 *
 * Quick start:
 *   1. Set org.id and bigquery.* below
 *   2. Map statuses.* to your master_auth_status values
 *   3. Copy .env.example → .env and add credentials + spreadsheet ID
 *   4. Share the Google Sheet with your service account email (Editor)
 *   5. npm install && npm run sync
 *
 * Cron (pick one):
 *   - GitHub Actions: copy cron/github-actions.yml into your repo
 *   - Local Mac/Linux: npm run cron
 */

export const dashboardConfig = {
  // ---------------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------------
  org: {
    /** Firestore / BigQuery org_id for medical_pa_order rows */
    id: 'rf5w1cNTGVfH9ZAJoLCF',

    /** Used in logs and sheet tab labels (optional) */
    displayName: 'Astera Radiology',
  },

  // ---------------------------------------------------------------------------
  // BigQuery source tables (CDC / Datastream pattern)
  // ---------------------------------------------------------------------------
  bigquery: {
    /** GCP project that owns the dataset */
    projectId: 'prior--backen-prod-svc-u4g8',

    /** Dataset containing medical_pa_* tables */
    dataset: 'medical_pa_prod_med_onc',

    tables: {
      order: 'medical_pa_order',
      orderStatus: 'medical_pa_order_status',
      demographics: 'demographics',
      authComments: 'auth_status_comments',
    },
  },

  // ---------------------------------------------------------------------------
  // Google Sheets destination
  // ---------------------------------------------------------------------------
  googleSheets: {
    /**
     * Spreadsheet ID from the URL:
     * https://docs.google.com/spreadsheets/d/<THIS_PART>/edit
     *
     * Prefer setting DASHBOARD_SPREADSHEET_ID in .env so secrets stay out of git.
     */
    spreadsheetIdEnvVar: 'DASHBOARD_SPREADSHEET_ID',

    /**
     * Monthly tabs are created as YYYY-MM_<suffix>
     * Example: 2026-07_summary
     */
    tabSuffix: 'summary',
  },

  // ---------------------------------------------------------------------------
  // Timezone & cohort logic
  // ---------------------------------------------------------------------------
  timezone: 'Asia/Kolkata',

  /**
   * Report date = order creation date in this timezone.
   * Summary metrics use creation cohort + current status at sync time.
   */
  cohort: {
    dateField: 'created_at',
    /** Skip Sat/Sun when writing rows */
    skipWeekends: true,
    /** Only write a row when cases_added > 0 */
    requireCasesAdded: true,
  },

  // ---------------------------------------------------------------------------
  // Auth statuses to track (master_auth_status values, lowercase)
  // ---------------------------------------------------------------------------
  statuses: {
    /** Counted in "Auth by RISA" column */
    authorized: ['auth_by_risa'],

    /** Counted in "NAR" column */
    nar: ['no_auth_required'],

    /** Counted in "Auth Pending" column */
    pending: ['pending'],

    /**
     * Counted in "Denials" when current status matches any of these.
     * Also combined with denial comments (see denialCommentTypes).
     */
    denied: ['denial_by_risa', 'denied_by_risa'],

    /**
     * auth_status_comments.comment_type values that count as a denial
     * (even if status later changes — counted once per order).
     */
    denialCommentTypes: ['denial'],
  },

  // ---------------------------------------------------------------------------
  // First Pass Approval Rate
  // ---------------------------------------------------------------------------
  firstPass: {
    /**
     * Formula: numerator / (numerator + denominatorStatuses)
     * Pending is excluded from the denominator.
     */
    numerator: 'authorized' as const,
    denominatorIncludes: ['authorized', 'denied'] as const,
  },

  // ---------------------------------------------------------------------------
  // Assignment / allotment helpers
  // ---------------------------------------------------------------------------
  assignment: {
    /** Treat these assigned_to_name values as "not allotted" */
    unassignedLabels: ['', 'unassigned'],

    /** Exclude from assignee-facing logic (if you add assignee tabs later) */
    excludedAssignees: ['risa agent'],
  },

  // ---------------------------------------------------------------------------
  // Scan value ($) — regimen name pattern → USD
  // ---------------------------------------------------------------------------
  scanValueRates: [
    { pattern: 'pet', value: 5500, flags: 'i' },
    { pattern: 'mri', value: 3000, flags: 'i' },
    { pattern: '\\bct\\b|computed tomography', value: 1000, flags: 'i' },
    { pattern: '\\bnm\\b|nuclear', value: 2000, flags: 'i' },
    { pattern: 'mammo', value: 300, flags: 'i' },
    { pattern: '\\bus\\b|ultrasound', value: 300, flags: 'i' },
    { pattern: 'x-?ray', value: 300, flags: 'i' },
  ],

  // ---------------------------------------------------------------------------
  // Sync behaviour
  // ---------------------------------------------------------------------------
  sync: {
    /** On each scheduled run, re-sync this many calendar days (updates pending → auth) */
    rollingWindowDays: 30,

    /** Pause between dates during rolling/backfill (ms) — avoids Sheets API rate limits */
    delayBetweenDatesMs: 3000,
  },

  // ---------------------------------------------------------------------------
  // Sheet column headers (order must match row builder in src/sheets.ts)
  // ---------------------------------------------------------------------------
  sheetColumns: [
    'Report Date',
    'Cases Added',
    'Unique Cases Added',
    'Allotted Cases %',
    'Non-Allotted MRNs',
    'Auth by RISA',
    'NAR',
    'Auth Pending',
    'Denials',
    'First Pass Approval %',
    'Denial Value ($)',
    'Total Scan Value ($)',
    'Last Updated',
  ],

  // ---------------------------------------------------------------------------
  // Cron schedule (IST) — used by cron/local-scheduler.ts and cron/github-actions.yml
  // ---------------------------------------------------------------------------
  cron: {
    /** Minute hour day month day-of-week — interpreted in timezone below */
    schedule: '0 11 * * *',
    timezone: 'Asia/Kolkata',
    description: 'Daily dashboard sync after prior-day work completes (~5 AM IST)',
  },
} as const;

export type DashboardConfig = typeof dashboardConfig;
