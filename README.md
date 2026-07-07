# Plug & Play — Google Sheets Daily Dashboard

Share this folder with anyone who needs a **BigQuery → Google Sheets** daily summary dashboard.  
Change **one config file** (`config/dashboard.config.ts`) — no code edits required for a new org.

## Folder structure

```
plug-and-play-sheets-dashboard/
├── config/
│   └── dashboard.config.ts   ← EDIT THIS (org, statuses, cron, scan $)
├── src/                      ← Source code (run as-is)
├── sql/                      ← BigQuery queries (placeholders filled from config)
├── cron/
│   ├── local-scheduler.ts    ← Run on your Mac/server: npm run cron
│   ├── github-dispatch.ts    ← IST-aware dispatcher for GitHub Actions
│   └── github-actions.yml    ← Copy to .github/workflows/ in your repo
├── .env.example
└── package.json
```

## 5-minute setup

### 1. Install

```bash
cd plug-and-play-sheets-dashboard
npm install
cp .env.example .env
```

### 2. Edit config (`config/dashboard.config.ts`)

| Setting | What to change |
|---------|----------------|
| `org.id` | Your Firestore/BigQuery `org_id` |
| `bigquery.projectId` / `dataset` / `tables` | Source tables |
| `statuses.*` | `master_auth_status` values you track |
| `scanValueRates` | Regimen → USD pricing |
| `cron.schedule` | Daily run time (IST), e.g. `0 11 * * *` |
| `googleSheets.tabSuffix` | Monthly tab name suffix |

### 3. Credentials (`.env`)

```bash
DASHBOARD_SPREADSHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**GCP permissions for the service account:**
- BigQuery: `roles/bigquery.dataViewer` on the dataset
- Google Sheets: share the spreadsheet with the SA email as **Editor**

### 4. Test manually

```bash
npm run sync                      # prior weekday
npm run sync -- 2026-07-01        # one date
npm run sync -- rolling 30        # last 30 days
npm run sync -- backfill 2026-07-01 2026-07-07
```

A tab `YYYY-MM_summary` is created automatically with one row per report date.

---

## Cron options

### Option A — Local (Mac / Linux server)

```bash
npm run cron
```

Uses `cron.schedule` and `cron.timezone` from `dashboard.config.ts`.  
Keep the process running (or use `pm2`, `launchd`, etc.).

### Option B — GitHub Actions (no local machine)

1. Push this folder to a GitHub repo
2. Copy `cron/github-actions.yml` → `.github/workflows/sheets-dashboard-cron.yml`
3. Add secrets:
   - `DASHBOARD_ENV_FILE` — paste full `.env` contents
   - `GCP_SA_KEY` — service account JSON
4. Update the workflow step to use the dispatcher:

```yaml
- run: npm run dispatch
```

The dispatcher checks IST time against `config/dashboard.config.ts` every 15 minutes.

**Force a run:** Actions → Run workflow, or `npm run dispatch:force` locally.

### Option C — Simple daily GHA (fixed UTC time)

For **11:00 AM IST** = **05:30 UTC**, use a single cron in the workflow:

```yaml
on:
  schedule:
    - cron: '30 5 * * *'
```

```yaml
- run: npm run sync -- rolling
```

---

## What the dashboard tracks

**Summary tab** (creation-date cohort, current status at sync time):

| Column | Source |
|--------|--------|
| Cases Added | Orders created on report date (IST) |
| Auth / NAR / Pending / Denials | Current `master_auth_status` in cohort |
| Denials | Denied status **or** denial comment (once per order) |
| First Pass % | Auth ÷ (Auth + Denials), pending excluded |
| Denial / Total $ | Scan rates × regimen for resolved cohort orders |

**Rolling re-sync** (`sync.rollingWindowDays`, default 30) updates past rows when pending cases resolve.

---

## Adapting for a new org

1. Set `org.id` and `bigquery.*`
2. Map `statuses.authorized`, `nar`, `pending`, `denied` to that org's status strings
3. Update `scanValueRates` if pricing differs
4. Create a new Google Sheet, set `DASHBOARD_SPREADSHEET_ID`, share with SA
5. Run `npm run sync -- backfill YYYY-MM-DD YYYY-MM-DD`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Set DASHBOARD_SPREADSHEET_ID` | Add spreadsheet ID to `.env` |
| `Permission denied` (BQ) | Grant SA BigQuery dataViewer on dataset |
| `The caller does not have permission` (Sheets) | Share sheet with SA email as Editor |
| Empty rows / 0 cases | Check `org.id` and that orders exist for that IST date |
| Wrong status counts | Update `statuses.*` in config to match your `master_auth_status` values |

---

## Extending

- **Assignee / TAT tabs:** add SQL files under `sql/` and extend `src/sync.ts` + `src/sheets.ts`
- **Holiday skip:** add allotment check in `src/dates.ts` (see main repo `astera-workday.ts`)
- **Multiple orgs:** duplicate the folder or add an `orgs[]` array in config
