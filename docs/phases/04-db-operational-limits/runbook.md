# Runbook

## Common Setup

1. DB와 관측 도구를 실행한다.

```bash
make db-start
```

2. 실험 조건에 맞춰 Spring Boot 서버를 실행한다. `LOCK_TIMEOUT`은 숫자만 넣으며 단위는 ms다. `LOCK_TIMEOUT=0`은 PostgreSQL 기본값인 무제한 lock wait를 의미한다.

```bash
make server-start POOL_SIZE=10
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

3. 서버가 적용한 pool size를 확인한다.

```powershell
curl http://localhost:8080/actuator/prometheus | Select-String "hikaricp_connections_max"
```

## Atomic Pool Matrix

Phase 3 baseline k6 조건은 유지하고 pool size만 바꾼다.

```bash
make server-start POOL_SIZE=2
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-2 PRESET=phase4-atomic-pool POOL=2 CONDITION=pool-2
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-2

make server-start POOL_SIZE=5
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-5 PRESET=phase4-atomic-pool POOL=5 CONDITION=pool-5
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-5

make server-start POOL_SIZE=10
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-10 PRESET=phase4-atomic-pool POOL=10 CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10

make server-start POOL_SIZE=20
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-20 PRESET=phase4-atomic-pool POOL=20 CONDITION=pool-20
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-20

make server-start POOL_SIZE=50
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-50 PRESET=phase4-atomic-pool POOL=50 CONDITION=pool-50
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-50
```

## Pessimistic Pool Matrix

Phase 3 baseline k6 조건은 유지하고 pool size별 lock wait와 p99 지표를 비교한다.

```bash
make server-start POOL_SIZE=2
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-2 PRESET=phase4-pessimistic-pool POOL=2 CONDITION=pool-2
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-2

make server-start POOL_SIZE=5
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-5 PRESET=phase4-pessimistic-pool POOL=5 CONDITION=pool-5
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-5

make server-start POOL_SIZE=10
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-10 PRESET=phase4-pessimistic-pool POOL=10 CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-10

make server-start POOL_SIZE=20
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-20 PRESET=phase4-pessimistic-pool POOL=20 CONDITION=pool-20
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-20

make server-start POOL_SIZE=50
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-50 PRESET=phase4-pessimistic-pool POOL=50 CONDITION=pool-50
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-50
```

## Pessimistic Timeout Matrix

Timeout 비교는 pool size를 Phase 3 default와 같은 10으로 둔다. 각 실행 전에 서버를 해당 `LOCK_TIMEOUT` 값으로 재시작한다.

```bash
make server-start POOL_SIZE=10 LOCK_TIMEOUT=200
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-200 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-200
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-200

make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-500
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500

make server-start POOL_SIZE=10 LOCK_TIMEOUT=1000
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-1000 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-1000
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-1000
```

## Hikari Prometheus Summary

각 k6 실행 후 run-window JSON의 `startedAt`~`endedAt` 본 실행 구간 기준으로 HikariCP aggregate evidence를 저장한다. `grafanaFrom`~`grafanaTo`는 dashboard 표시용 패딩 구간이므로 summary 계산에 사용하지 않는다.

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/run-window-*.json | Sort-Object Name -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json
```

`hikariMaxMin`과 `hikariMaxMax`는 실행 pool size와 같아야 한다. 다르면 다음 실행의 scrape가 섞였거나 잘못된 run-window를 사용한 것이므로 해당 summary를 폐기한다.

## Lock Wait Snapshots

Pessimistic pool 실험 중 `pool-10`, `pool-50`에서 `pg_locks`, `pg_stat_activity` snapshot을 저장한다.

`k6-evidence`가 실행 중일 때 별도 터미널에서 다음 명령을 실행한다.

```bash
mkdir -p docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/pg-lock-wait-snapshot.sql \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/pg-lock-summary.sql \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt
docker compose exec -T postgres psql -U user -d reservation \
  -c "select pid, state, wait_event_type, wait_event, query from pg_stat_activity where datname = 'reservation' order by pid;" \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-stat-activity.txt

mkdir -p docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/pg-lock-wait-snapshot.sql \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/pg-lock-summary.sql \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt
docker compose exec -T postgres psql -U user -d reservation \
  -c "select pid, state, wait_event_type, wait_event, query from pg_stat_activity where datname = 'reservation' order by pid;" \
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-stat-activity.txt
```

## Grafana Capture Policy

모든 조합을 캡처하지 않고 다음 대표 조합만 캡처한다.

- Atomic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic timeout: `timeout-500`

## Related Guides

- [PostgreSQL Monitoring](../../guides/postgres-monitoring.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
