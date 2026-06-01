# Grafana Dashboard Generator YAML Refactor Implementation Plan - 004 YAML Specs and Overview Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 JS generator에 있던 overview dashboard의 PromQL과 row/panel 구성을 YAML source of truth로 옮긴다.

**Architecture:** `dashboards/overview.yml`은 dashboard metadata, variables, row order만 가진다. `rows/*.yml`은 panel 목록을 가진다. `queries/*.yml`은 PromQL alias를 가진다.

**Tech Stack:** YAML, Grafana dashboard concepts, Prometheus PromQL.

---

## Task 004: YAML Specs and Overview Dashboard

**Files:**

- Create: `scripts/grafana/dashboards/overview.yml`
- Create: `scripts/grafana/rows/run-summary.yml`
- Create: `scripts/grafana/rows/k6-load.yml`
- Create: `scripts/grafana/rows/spring-api.yml`
- Create: `scripts/grafana/rows/spring-runtime.yml`
- Create: `scripts/grafana/rows/hikari-pool.yml`
- Create: `scripts/grafana/rows/postgres-activity.yml`
- Create: `scripts/grafana/rows/table-access.yml`
- Create: `scripts/grafana/rows/reservation-consistency.yml`
- Create: `scripts/grafana/queries/k6.yml`
- Create: `scripts/grafana/queries/spring.yml`
- Create: `scripts/grafana/queries/hikari.yml`
- Create: `scripts/grafana/queries/postgres.yml`
- Create: `scripts/grafana/queries/reservation.yml`

- [ ] **Step 1: dashboard spec을 작성한다**

Create `scripts/grafana/dashboards/overview.yml`:

```yaml
uid: concurrency-lab-overview
slug: concurrency-lab-overview
output: concurrency-lab-overview.json
title: Concurrency Lab Overview
tags:
  - concurrency-lab
  - reservation
  - observability

variables:
  phase:
    label: Phase
    query: 'label_values(k6_http_reqs_total, phase)'
    default: phase-02
  scenario:
    label: Scenario
    query: 'label_values(k6_http_reqs_total{phase="$phase"}, scenario)'
    default: no-lock
  preset:
    label: Preset
    query: 'label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario"}, preset)'
    default: baseline
  pool:
    label: Pool
    query: 'label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset"}, pool)'
    default: default
  uri:
    label: URI
    query: 'label_values(http_server_requests_seconds_count, uri)'
    default: '$__all'
    includeAll: true
    multi: true
  table:
    label: Table
    query: 'label_values(pg_stat_user_tables_seq_scan, relname)'
    default: '$__all'
    includeAll: true
    multi: true

rows:
  - run-summary
  - k6-load
  - spring-api
  - spring-runtime
  - hikari-pool
  - postgres-activity
  - table-access
  - reservation-consistency
```

- [ ] **Step 2: k6 query aliases를 작성한다**

Create `scripts/grafana/queries/k6.yml`:

```yaml
k6.http.p95:
  expr: 'max(k6_http_req_duration_p95{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

k6.http.p99:
  expr: 'max(k6_http_req_duration_p99{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

k6.http.rps:
  expr: 'sum(rate(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}[$__rate_interval]))'

k6.http.error-rate:
  expr: 'avg(k6_http_req_failed_rate{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}) * 100'

k6.http.success-rps:
  expr: 'sum(rate(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool", expected_response="true"}[$__rate_interval]))'

k6.http.error-rps:
  expr: 'sum(rate(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool", expected_response="false"}[$__rate_interval]))'

k6.vus:
  expr: 'sum(k6_vus{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

k6.iteration.p95:
  expr: 'max(k6_iteration_duration_p95{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

k6.checks.success-percent:
  expr: 'avg(k6_checks_rate{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}) * 100'

k6.checks.by-name:
  expr: 'avg by (check) (k6_checks_rate{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}) * 100'

k6.dropped-iterations.total:
  expr: 'sum(increase(k6_dropped_iterations_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}[$__range]))'

k6.dropped-iterations.rate:
  expr: 'sum(rate(k6_dropped_iterations_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}[$__rate_interval]))'
```

- [ ] **Step 3: Spring, Hikari, PostgreSQL, Reservation query aliases를 작성한다**

Create `scripts/grafana/queries/spring.yml`:

```yaml
spring.http.request-rate-by-uri:
  expr: 'sum by (uri) (rate(http_server_requests_seconds_count{uri=~"$uri", uri!="/actuator/prometheus", uri!="/**"}[$__rate_interval]))'

spring.http.p95-by-uri:
  expr: 'histogram_quantile(0.95, sum by (le, uri) (rate(http_server_requests_seconds_bucket{uri=~"$uri", uri!="/actuator/prometheus", uri!="/**"}[$__rate_interval])))'

spring.http.errors-by-status:
  expr: 'sum by (status) (rate(http_server_requests_seconds_count{status!~"2..", uri!="/actuator/prometheus", uri!="/**"}[$__rate_interval]))'

spring.runtime.heap-used-percent:
  expr: 'sum(jvm_memory_used_bytes{area="heap"}) * 100 / sum(jvm_memory_max_bytes{area="heap"})'

spring.runtime.process-cpu-percent:
  expr: 'process_cpu_usage * 100'

spring.runtime.gc-pause-rate:
  expr: 'sum(rate(jvm_gc_pause_seconds_sum[$__rate_interval]))'
```

Create `scripts/grafana/queries/hikari.yml`:

```yaml
hikari.timeout-count:
  expr: 'sum(increase(hikaricp_connections_timeout_total[$__range]))'

hikari.pending-max:
  expr: 'max(max_over_time(hikaricp_connections_pending[$__range]))'

hikari.active:
  expr: 'hikaricp_connections_active'

hikari.max:
  expr: 'hikaricp_connections_max'

hikari.pending:
  expr: 'hikaricp_connections_pending'

hikari.acquire-time:
  expr: 'rate(hikaricp_connections_acquire_seconds_sum[$__rate_interval]) / rate(hikaricp_connections_acquire_seconds_count[$__rate_interval])'
```

Create `scripts/grafana/queries/postgres.yml`:

```yaml
postgres.connections.used-percent:
  expr: 'sum(pg_stat_database_numbackends) / max(pg_settings_max_connections) * 100'

postgres.activity.active-sessions:
  expr: 'sum(pg_stat_activity_count{state="active"})'

postgres.locks.by-mode:
  expr: 'sum by (mode) (pg_locks_count)'

postgres.xact.commit-rate:
  expr: 'rate(pg_stat_database_xact_commit[$__rate_interval])'

postgres.xact.rollback-rate:
  expr: 'rate(pg_stat_database_xact_rollback[$__rate_interval])'

postgres.table.seq-scan-by-table:
  expr: 'sum by (relname) (rate(pg_stat_user_tables_seq_scan{relname=~"$table"}[$__rate_interval]))'

postgres.table.idx-scan-by-table:
  expr: 'sum by (relname) (rate(pg_stat_user_tables_idx_scan{relname=~"$table"}[$__rate_interval]))'

postgres.table.seq-tuples-read-rate-by-table:
  expr: 'sum by (relname) (rate(pg_stat_user_tables_seq_tup_read{relname=~"$table"}[$__rate_interval]))'

postgres.table.idx-tuples-fetch-rate-by-table:
  expr: 'sum by (relname) (rate(pg_stat_user_tables_idx_tup_fetch{relname=~"$table"}[$__rate_interval]))'
```

Create `scripts/grafana/queries/reservation.yml`:

```yaml
reservation.count:
  expr: 'max(k6_concert_reservation_count{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

reservation.remaining-seats:
  expr: 'max(k6_concert_remaining_seats{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

reservation.seat-count-inconsistency:
  expr: 'max(k6_concert_seat_count_inconsistency{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'

reservation.overbooked:
  expr: 'max(k6_concert_overbooked{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})'
```

- [ ] **Step 4: row YAML 파일을 작성한다**

Create `scripts/grafana/rows/run-summary.yml`:

```yaml
id: run-summary
title: Run Summary
panels:
  - type: stat
    title: k6 p95
    query: k6.http.p95
    unit: s
    calc: max
  - type: stat
    title: k6 p99
    query: k6.http.p99
    unit: s
    calc: max
  - type: stat
    title: Actual RPS
    query: k6.http.rps
    unit: reqps
    calc: max
  - type: stat
    title: Error Rate
    query: k6.http.error-rate
    unit: percent
  - type: stat
    title: Checks Success
    query: k6.checks.success-percent
    unit: percent
  - type: stat
    title: Dropped Iterations
    query: k6.dropped-iterations.total
  - type: stat
    title: PG Connections Used
    query: postgres.connections.used-percent
    unit: percent
  - type: stat
    title: Hikari Pending Max
    query: hikari.pending-max
```

Create `scripts/grafana/rows/k6-load.yml`:

```yaml
id: k6-load
title: k6 Load
panels:
  - type: timeseries
    title: Performance Overview
    w: 24
    h: 10
    tooltipMode: multi
    targets:
      - query: k6.vus
        legend: vus
      - query: k6.http.rps
        legend: rps
      - query: k6.http.error-rps
        legend: error_rps
      - query: k6.http.p95
        legend: p95_latency
  - type: timeseries
    title: HTTP Request Rate
    tooltipMode: multi
    targets:
      - query: k6.http.success-rps
        legend: success_rps
      - query: k6.http.error-rps
        legend: error_rps
  - type: timeseries
    title: Latency and Iteration p95
    tooltipMode: multi
    targets:
      - query: k6.http.p95
        legend: http_p95
      - query: k6.iteration.p95
        legend: iteration_p95
  - type: timeseries
    title: Checks Success Rate
    query: k6.checks.by-name
    legend: '{{check}}'
  - type: timeseries
    title: Dropped Iterations
    query: k6.dropped-iterations.rate
    legend: dropped
```

Create `scripts/grafana/rows/spring-api.yml`:

```yaml
id: spring-api
title: Spring API
panels:
  - type: timeseries
    title: HTTP Request Rate by URI
    query: spring.http.request-rate-by-uri
    legend: '{{uri}}'
    w: 24
  - type: timeseries
    title: HTTP p95 by URI
    query: spring.http.p95-by-uri
    legend: '{{uri}}'
  - type: timeseries
    title: HTTP Errors by Status
    query: spring.http.errors-by-status
    legend: '{{status}}'
```

Create `scripts/grafana/rows/spring-runtime.yml`:

```yaml
id: spring-runtime
title: Spring Runtime
panels:
  - type: stat
    title: Hikari Timeout Count
    query: hikari.timeout-count
  - type: stat
    title: Heap Used
    query: spring.runtime.heap-used-percent
    unit: percent
  - type: timeseries
    title: Process CPU Usage
    query: spring.runtime.process-cpu-percent
    legend: process_cpu
  - type: timeseries
    title: GC Pause Time
    query: spring.runtime.gc-pause-rate
    legend: gc_pause
```

Create `scripts/grafana/rows/hikari-pool.yml`:

```yaml
id: hikari-pool
title: Hikari Pool
panels:
  - type: timeseries
    title: Active Connections
    query: hikari.active
    legend: active
  - type: timeseries
    title: Max Connections
    query: hikari.max
    legend: max
  - type: timeseries
    title: Pending Threads
    query: hikari.pending
    legend: pending
  - type: timeseries
    title: Acquire Time
    query: hikari.acquire-time
    legend: avg acquire
```

Create `scripts/grafana/rows/postgres-activity.yml`:

```yaml
id: postgres-activity
title: PostgreSQL Activity
panels:
  - type: timeseries
    title: Active Sessions
    query: postgres.activity.active-sessions
    legend: active
  - type: timeseries
    title: Locks
    query: postgres.locks.by-mode
    legend: '{{mode}}'
  - type: timeseries
    title: Commit Rate
    query: postgres.xact.commit-rate
    legend: commit
  - type: timeseries
    title: Rollback Rate
    query: postgres.xact.rollback-rate
    legend: rollback
```

Create `scripts/grafana/rows/table-access.yml`:

```yaml
id: table-access
title: Table Access
panels:
  - type: timeseries
    title: Seq Scan by Table
    query: postgres.table.seq-scan-by-table
    legend: '{{relname}}'
    w: 24
  - type: timeseries
    title: Index Scan by Table
    query: postgres.table.idx-scan-by-table
    legend: '{{relname}}'
    w: 24
  - type: timeseries
    title: Seq Tuples Read Rate by Table
    query: postgres.table.seq-tuples-read-rate-by-table
    legend: '{{relname}}'
  - type: timeseries
    title: Index Tuples Fetch Rate by Table
    query: postgres.table.idx-tuples-fetch-rate-by-table
    legend: '{{relname}}'
```

Create `scripts/grafana/rows/reservation-consistency.yml`:

```yaml
id: reservation-consistency
title: Reservation Consistency
panels:
  - type: stat
    title: Reservation Count
    query: reservation.count
  - type: stat
    title: Remaining Seats
    query: reservation.remaining-seats
  - type: stat
    title: Seat Count Inconsistency
    query: reservation.seat-count-inconsistency
  - type: stat
    title: Overbooked
    query: reservation.overbooked
```

- [ ] **Step 5: YAML 파일이 parse 가능한지 확인한다**

Run:

```bash
node - <<'NODE'
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

for (const dir of ['scripts/grafana/dashboards', 'scripts/grafana/rows', 'scripts/grafana/queries']) {
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.yml')) continue;
    parse(await readFile(join(dir, file), 'utf8'));
    console.log(`${dir}/${file}`);
  }
}
NODE
```

Expected: all created `.yml` paths are printed and the command exits with status `0`.

- [ ] **Step 6: 커밋한다**

```bash
git add scripts/grafana/dashboards scripts/grafana/rows scripts/grafana/queries
git commit -m "feat: migrate grafana overview dashboard spec"
```
