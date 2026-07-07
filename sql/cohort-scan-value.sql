-- Scan $ for creation cohort @report_date — current status as-of sync.
-- Placeholders {{...}} replaced from config at runtime.
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
    o.regimen_name,
    LOWER(TRIM(COALESCE(s.master_auth_status, ''))) AS auth_status
  FROM latest_order AS o
  LEFT JOIN latest_status AS s ON s.order_id = o.order_id
  CROSS JOIN params AS p
  WHERE DATE(o.created_at, '{{TIMEZONE}}') = p.report_date
),
orders_with_denial_comment AS (
  SELECT DISTINCT c.order_id
  FROM auth_comments AS c
  JOIN orders_on_day AS od ON od.order_id = c.order_id
  WHERE LOWER(TRIM(c.comment_type)) IN ({{DENIAL_COMMENT_TYPES_SQL}})
)
SELECT
  CASE
    WHEN od.auth_status IN ({{AUTHORIZED_STATUSES_SQL}}) THEN 'auth'
    WHEN od.auth_status IN ({{NAR_STATUSES_SQL}}) THEN 'nar'
    WHEN od.auth_status IN ({{DENIED_STATUSES_SQL}}) OR dwc.order_id IS NOT NULL THEN 'denial'
    ELSE NULL
  END AS row_type,
  od.regimen_name
FROM orders_on_day AS od
LEFT JOIN orders_with_denial_comment AS dwc ON dwc.order_id = od.order_id
WHERE
  od.auth_status IN ({{AUTHORIZED_STATUSES_SQL}})
  OR od.auth_status IN ({{NAR_STATUSES_SQL}})
  OR od.auth_status IN ({{DENIED_STATUSES_SQL}})
  OR dwc.order_id IS NOT NULL;
