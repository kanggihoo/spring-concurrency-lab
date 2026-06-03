SELECT
  locktype,
  relation::regclass AS relation,
  mode,
  granted,
  count(*) AS count
FROM pg_locks
WHERE relation IS NOT NULL
GROUP BY locktype, relation, mode, granted
ORDER BY granted, count DESC;
