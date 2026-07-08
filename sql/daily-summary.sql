-- Daily summary: creation cohort @report_date, current status as-of sync.
-- Placeholders {{...}} are replaced from config/dashboard.config.ts at runtime.
-- Params: @report_date DATE, @org_id STRING

WITH params AS (
  SELECT @report_date AS report_date, @org_id AS org_id
),
latest_order AS (
  SELECT * EXCEPT (_cdc_rank, _change_type)
  FROM (
    SELECT t.*, datastream_metadata.change_type AS _change_type,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY datastream_metadata.source_timestamp DESC,
        datastream_metadata.change_sequence_number DESC, datastream_metadata.uuid DESC) AS _cdc_rank
    FROM `{{BQ_TABLE_ORDER}}` AS t
    WHERE t.org_id = @org_id
  )
  WHERE _cdc_rank = 1 AND COALESCE(_change_type, '') != 'DELETE'
),
latest_status AS (
  SELECT * EXCEPT (_cdc_rank, _change_type)
  FROM (
    SELECT t.*, datastream_metadata.change_type AS _change_type,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY datastream_metadata.source_timestamp DESC,
        datastream_metadata.change_sequence_number DESC, datastream_metadata.uuid DESC) AS _cdc_rank
    FROM `{{BQ_TABLE_ORDER_STATUS}}` AS t
    WHERE t.org_id = @org_id
  )
  WHERE _cdc_rank = 1 AND COALESCE(_change_type, '') != 'DELETE'
),
latest_demo AS (
  SELECT * EXCEPT (_cdc_rank, _change_type)
  FROM (
    SELECT t.*, datastream_metadata.change_type AS _change_type,
      ROW_NUMBER() OVER (PARTITION BY id ORDER BY datastream_metadata.source_timestamp DESC,
        datastream_metadata.change_sequence_number DESC, datastream_metadata.uuid DESC) AS _cdc_rank
    FROM `{{BQ_TABLE_DEMOGRAPHICS}}` AS t
    WHERE t.org_id = @org_id
  )
  WHERE _cdc_rank = 1 AND COALESCE(_change_type, '') != 'DELETE'
),
auth_comments AS (
  SELECT * EXCEPT (_cdc_rank, _change_type)
  FROM (
    SELECT t.*, datastream_metadata.change_type AS _change_type,
      ROW_NUMBER() OVER (PARTITION BY id ORDER BY datastream_metadata.source_timestamp DESC,
        datastream_metadata.change_sequence_number DESC, datastream_metadata.uuid DESC) AS _cdc_rank
    FROM `{{BQ_TABLE_AUTH_COMMENTS}}` AS t
    WHERE t.org_id = @org_id
  )
  WHERE _cdc_rank = 1 AND COALESCE(_change_type, '') != 'DELETE'
),
orders_on_day AS (
  SELECT
    o.order_id,
    COALESCE(d.patient_id, o.patient_id) AS mrn,
    o.regimen_name,
    o.date_of_service,
    o.assigned_to_name,
    LOWER(TRIM(COALESCE(s.master_auth_status, ''))) AS auth_status,
    CONCAT(
      COALESCE(o.regimen_name, ''),
      '|',
      COALESCE(d.patient_id, o.patient_id),
      '|',
      COALESCE(CAST(o.date_of_service AS STRING), '')
    ) AS case_key
  FROM latest_order AS o
  LEFT JOIN latest_status AS s ON s.order_id = o.order_id
  LEFT JOIN latest_demo AS d ON d.order_id = o.order_id
  CROSS JOIN params AS p
  WHERE DATE(o.created_at, '{{TIMEZONE}}') = p.report_date
),
orders_in_lookback AS (
  SELECT
    CONCAT(
      COALESCE(o.regimen_name, ''),
      '|',
      COALESCE(d.patient_id, o.patient_id),
      '|',
      COALESCE(CAST(o.date_of_service AS STRING), '')
    ) AS case_key,
    DATE(o.created_at, '{{TIMEZONE}}') AS created_local
  FROM latest_order AS o
  LEFT JOIN latest_demo AS d ON d.order_id = o.order_id
  CROSS JOIN params AS p
  WHERE DATE(o.created_at, '{{TIMEZONE}}') BETWEEN DATE_SUB(p.report_date, INTERVAL {{UNIQUE_LOOKBACK_DAYS}} DAY)
    AND p.report_date
),
prior_case_keys AS (
  SELECT DISTINCT w.case_key
  FROM orders_in_lookback AS w
  CROSS JOIN params AS p
  WHERE w.created_local < p.report_date
),
orders_with_denial_comment AS (
  SELECT DISTINCT c.order_id
  FROM auth_comments AS c
  JOIN orders_on_day AS od ON od.order_id = c.order_id
  WHERE LOWER(TRIM(c.comment_type)) IN ({{DENIAL_COMMENT_TYPES_SQL}})
),
cohort_outcomes AS (
  SELECT
    od.order_id,
    od.auth_status,
    (
      od.auth_status IN ({{DENIED_STATUSES_SQL}})
      OR dwc.order_id IS NOT NULL
    ) AS is_denial
  FROM orders_on_day AS od
  LEFT JOIN orders_with_denial_comment AS dwc ON dwc.order_id = od.order_id
),
day_agg AS (
  SELECT
    COUNT(*) AS cases_added,
    COUNTIF(pk.case_key IS NULL) AS unique_cases_added,
    COUNTIF(LOWER(TRIM(COALESCE(assigned_to_name, ''))) NOT IN ({{UNASSIGNED_LABELS_SQL}})) AS allotted_cases,
    STRING_AGG(DISTINCT IF(LOWER(TRIM(COALESCE(assigned_to_name, ''))) IN ({{UNASSIGNED_LABELS_SQL}}), mrn, NULL), ', ') AS non_allotted_mrns
  FROM orders_on_day AS od
  LEFT JOIN prior_case_keys AS pk ON pk.case_key = od.case_key
),
outcome_agg AS (
  SELECT
    COUNTIF(auth_status IN ({{AUTHORIZED_STATUSES_SQL}})) AS auth_by_risa_count,
    COUNTIF(auth_status IN ({{NAR_STATUSES_SQL}})) AS nar_count,
    COUNTIF(auth_status IN ({{PENDING_STATUSES_SQL}})) AS auth_pending_count,
    COUNTIF(is_denial) AS denial_count
  FROM cohort_outcomes
)
SELECT
  p.report_date,
  p.org_id,
  d.cases_added,
  d.unique_cases_added,
  ROUND(SAFE_DIVIDE(d.allotted_cases, NULLIF(d.cases_added, 0)) * 100, 1) AS allotted_cases_pct,
  d.non_allotted_mrns,
  o.auth_by_risa_count,
  o.nar_count,
  o.auth_pending_count,
  o.denial_count,
  ROUND(
    SAFE_DIVIDE(o.auth_by_risa_count, NULLIF(o.auth_by_risa_count + o.denial_count, 0)) * 100,
    1
  ) AS first_pass_approval_rate_pct
FROM params AS p
CROSS JOIN day_agg AS d
CROSS JOIN outcome_agg AS o;
