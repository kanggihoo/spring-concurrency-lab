SELECT
  a.pid,
  a.state,
  a.wait_event_type,
  a.wait_event,
  now() - a.query_start AS query_age,
  now() - a.xact_start AS xact_age,
  pg_blocking_pids(a.pid) AS blocking_pids,
  a.query
FROM pg_stat_activity a
WHERE a.datname = 'reservation'
  AND a.wait_event_type IS NOT NULL
ORDER BY query_age DESC;
