# Grafana Provisioning and Phase 2 Observability Design

## Context

Phase 2 No Lock Baseline needs repeatable performance evidence before comparing later concurrency strategies. Phase 1 already validated the local measurement path: Spring Boot, PostgreSQL, postgres_exporter, Prometheus, Grafana, k6, and reset flow.

Before starting Phase 2, Grafana dashboards should be provisioned from files instead of created manually in the UI. The dashboards should support both cross-phase observation and Phase 2-specific evidence capture.

## Decision

Use a generator-based Grafana setup with two dashboards:

- **Concurrency Lab Overview**: shared dashboard for common k6, Spring, Hikari, PostgreSQL, and table access metrics.
- **Phase 2 No Lock Baseline**: focused dashboard for the no-lock Reservation experiment and final consistency snapshot.

Provision the Prometheus datasource and dashboard provider through Grafana provisioning files. Generate dashboard JSON from a JavaScript script, and keep the generated JSON as an artifact rather than the primary editing surface.

Grafana capture will be automated with Playwright, but only for dashboard navigation and scrolling screenshots. Stitching screenshots into one image, running k6, and writing reports are separate concerns.

## File Layout

```text
package.json
scripts/
  generate-grafana-dashboards.js
  capture-grafana-dashboard.js
  sql/
    phase2-consistency-check.sql
grafana/
  provisioning/
    datasources/
      prometheus.yml
    dashboards/
      dashboards.yml
  dashboards/
    concurrency-lab-overview.json
    phase-02-no-lock-baseline.json
docs/evidence/
  02-no-lock-baseline/
    grafana/
      parts/
    sql/
```

## Docker Compose Changes

Mount Grafana provisioning and dashboard directories into the `grafana` service.

```yaml
volumes:
  - grafana-storage:/var/lib/grafana
  - ./grafana/provisioning:/etc/grafana/provisioning
  - ./grafana/dashboards:/var/lib/grafana/dashboards
```

Enable anonymous viewer access so Playwright can open dashboards without an interactive login.

```yaml
environment:
  GF_SECURITY_ADMIN_USER: admin
  GF_SECURITY_ADMIN_PASSWORD: admin
  GF_AUTH_ANONYMOUS_ENABLED: "true"
  GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
```

## Dashboard Generator

`scripts/generate-grafana-dashboards.js` is the source of truth for dashboard JSON. It should:

- define shared helpers for rows, stat panels, time series panels, table panels, targets, variables, and `or vector(0)` fallback expressions
- generate both dashboard JSON files
- keep datasource references fixed to `{ type: "prometheus", uid: "prometheus" }`
- use project-specific titles and tags such as `concurrency-lab`, `reservation`, and `observability`
- remove previous-project concepts such as ecommerce, orders, products, index focus, N+1 focus, and pagination focus

`package.json` should expose:

```json
{
  "scripts": {
    "grafana:generate": "node scripts/generate-grafana-dashboards.js",
    "grafana:capture": "node scripts/capture-grafana-dashboard.js",
    "grafana:capture:phase2": "node scripts/capture-grafana-dashboard.js --dashboard phase2 --phase phase-02 --scenario no-lock --preset baseline --pool default --live"
  }
}
```

## Overview Dashboard

The overview dashboard is shared across phases.

Include:

- Run Summary: k6 p95, p99, RPS, error rate, checks success, dropped iterations, PostgreSQL connection usage, Hikari pending max
- k6 Load: VUs, RPS, error RPS, p95 latency, request rate, latency, checks, dropped iterations
- Spring API: request rate by URI, p95 by URI, errors by status
- Spring Runtime: heap usage, process CPU, GC pause
- Hikari Pool: active, max, pending, acquire time, timeout count
- PostgreSQL Activity: active sessions, locks, commit rate, rollback rate
- Table Access: sequential scans, index scans, sequential tuples read, index tuples fetched

Do not include Redis panels yet. Redis observability starts in Phase 5.

## Phase 2 Dashboard

The Phase 2 dashboard focuses on the no-lock Reservation experiment.

Include:

- Reservation Run Summary: `/api/reservations` RPS, p95, p99, error rate, status distribution
- k6 Baseline: VUs, RPS, checks, dropped iterations, latency
- Consistency Snapshot: final Reservation count, Remaining Seats, Seat Count Inconsistency, Overbooked flag
- DB Pressure: Hikari active, pending, acquire time, timeout count, PostgreSQL active sessions and locks
- Table Focus: `concert` and `reservation` table access metrics

The dashboard should support `phase`, `scenario`, `preset`, `pool`, `uri`, and `table` variables. Defaults for Phase 2 are:

- `phase`: `phase-02`
- `scenario`: `no-lock`
- `preset`: `baseline`
- `pool`: `default`

## Phase 2 Consistency Snapshot

Do not expose live Spring Gauges that query the DB on every Prometheus scrape.

Instead:

1. Spring exposes `GET /api/test/consistency`.
2. k6 calls this endpoint once at the end of the run.
3. k6 writes final snapshot values as custom metrics through Prometheus remote write.
4. Grafana displays the final snapshot metrics.
5. A separate SQL check writes a `.txt` evidence file from PostgreSQL.

Expected consistency response:

```json
{
  "concertId": 1,
  "initialSeatCount": 100,
  "reservationCount": 137,
  "remainingSeats": 12,
  "seatCountInconsistency": 49,
  "overbooked": true
}
```

k6 custom metrics:

- `concert_reservation_count`
- `concert_remaining_seats`
- `concert_seat_count_inconsistency`
- `concert_overbooked`

If k6 `teardown()` does not reliably remote-write final custom metrics, replace it with a small explicit consistency snapshot step or scenario.

## SQL Evidence

Also keep raw SQL evidence outside Grafana.

Add `scripts/sql/phase2-consistency-check.sql`:

```sql
SELECT
    c.id AS concert_id,
    100 AS initial_seat_count,
    COUNT(r.id) AS reservation_count,
    c.remaining_seats,
    COUNT(r.id) + c.remaining_seats - 100 AS seat_count_inconsistency,
    COUNT(r.id) > 100 AS overbooked
FROM concert c
LEFT JOIN reservation r ON r.concert_id = c.id
WHERE c.id = 1
GROUP BY c.id, c.remaining_seats;
```

Run it after k6 and save output under `docs/evidence/02-no-lock-baseline/sql/`, for example:

```bash
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/phase2-consistency-check.sql \
  > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
```

Grafana is the visual summary. SQL `.txt` is the raw verification evidence.

## k6 Tags and Presets

All Phase 2 k6 scripts should emit common tags:

- `phase=phase-02`
- `scenario=no-lock`
- `preset=baseline|spike|ramp-up|sustained`
- `pool=default`

Only `preset=baseline` is required for the Phase 2 completion gate. Other presets are optional extended evidence:

- `baseline`: required; baseline performance and Seat Count Inconsistency evidence
- `spike`: optional; sudden traffic burst behavior
- `ramp-up`: optional; threshold search under increasing VUs
- `sustained`: optional; longer DB and runtime pressure observation

## Grafana Capture Automation

`scripts/capture-grafana-dashboard.js` should automate Grafana capture only.

Responsibilities:

- build a Grafana dashboard URL from dashboard id and variables
- open Grafana through anonymous viewer access
- wait for dashboard rendering
- locate the dashboard scroll container
- scroll from top to bottom and save multiple screenshot parts
- write capture metadata

The script should not stitch images, run k6, update reports, or interpret results.

Expected output shape:

```text
docs/evidence/02-no-lock-baseline/grafana/parts/
  part-01-scroll0.png
  part-02-scroll900.png
  part-03-scroll1800.png
  capture-meta.json
```

The exact selector and any row-focus behavior must be verified with the user against the real Grafana UI. The first implementation should prefer full-dashboard scrolling capture with all relevant rows expanded. Row collapse/expand automation can be added later after checking Grafana's actual DOM and accessible names.

## Out of Scope

- Redis dashboard panels
- a full pipeline that runs k6 and captures Grafana in one command
- report generation
- screenshot stitching
- row focus/collapse automation
- multi-Concert metric cardinality
- live DB-backed Spring Gauges

## Verification

The implementation is complete when:

- `npm run grafana:generate` creates both dashboard JSON files
- Grafana loads the Prometheus datasource with `uid: prometheus`
- Grafana provisions both dashboards on `docker compose up -d`
- anonymous viewer access opens dashboards without login
- Phase 2 k6 metrics can be filtered by `phase`, `scenario`, `preset`, and `pool`
- `GET /api/test/consistency` returns Concert 1 final consistency data
- k6 writes final consistency snapshot metrics after the run
- SQL consistency check writes a `.txt` evidence file
- Playwright capture saves scrolled dashboard parts and metadata
