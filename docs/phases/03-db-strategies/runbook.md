# Runbook

Phase 3 DB strategy baselines are measured one strategy at a time. Before running k6, start PostgreSQL, Prometheus, Grafana, and the Spring Boot app, then verify that `POST /api/test/reset` returns HTTP 200.

## k6 baselines

```powershell
bash k6/run.sh phase3-pessimistic-baseline prometheus
bash k6/run.sh phase3-optimistic-baseline prometheus
bash k6/run.sh phase3-atomic-baseline prometheus
```

Each run writes k6 summary, logs, and a Grafana run-window JSON under the matching strategy directory:

- `docs/evidence/03-db-strategies/pessimistic-lock/`
- `docs/evidence/03-db-strategies/optimistic-lock/`
- `docs/evidence/03-db-strategies/atomic-update/`

## Grafana captures

For Phase 3, use the Makefile target that finds the latest strategy-specific run-window and passes it explicitly to the capture script. The overview dashboard's `--run-window auto` lookup does not search the nested strategy evidence directories.

```powershell
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-capture STRATEGY=optimistic-lock
make phase3-grafana-capture STRATEGY=atomic-update
```

## Grafana stitched images

After capturing parts, stitch the images per strategy:

```powershell
make phase3-grafana-stitch STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=optimistic-lock
make phase3-grafana-stitch STRATEGY=atomic-update
```

Or run all three:

```powershell
make phase3-grafana-stitches
```

## SQL consistency evidence

Run the consistency check after each strategy run and save the output in the matching strategy directory.

```powershell
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=optimistic-lock
make phase3-sql-consistency STRATEGY=atomic-update
```

`make phase3-sql-consistencies` runs all three commands, but use it only when the database state has been reset and measured per strategy in the same sequence.

Expected result for each strategy:

- `seat_count_inconsistency = 0`
- `overbooked = false`

## Reporting

Record the measured k6 summary values, SQL consistency result, and Grafana evidence paths in `docs/phases/03-db-strategies/report.md`.

## Related Guides

- [k6 Load Testing](../../guides/k6-load-testing.md)
- [PostgreSQL Monitoring](../../guides/postgres-monitoring.md)
- [Result Recording](../../guides/result-recording.md)
