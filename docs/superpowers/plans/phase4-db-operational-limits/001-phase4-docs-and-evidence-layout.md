# 001. Phase 4 Docs and Evidence Layout

### Task 001: Align Phase 4 Documentation with Operational Limits

**Files:**
- Modify: `docs/phases/04-db-operational-limits/scope.md`
- Modify: `docs/phases/04-db-operational-limits/runbook.md`
- Modify: `docs/phases/04-db-operational-limits/observability.md`
- Modify: `docs/phases/04-db-operational-limits/report.md`
- Modify: `docs/guides/commands.md`
- Modify: `docs/guides/project-format-standard.md`
- Ensure directories: `docs/evidence/04-db-operational-limits/atomic-pool`
- Ensure directories: `docs/evidence/04-db-operational-limits/pessimistic-pool`
- Ensure directories: `docs/evidence/04-db-operational-limits/pessimistic-timeout`

- [ ] **Step 1: Update scope**

Rewrite `docs/phases/04-db-operational-limits/scope.md` so it includes:

```markdown
# Scope

## Goal

Phase 3에서 확인한 DB 기반 Reservation 전략이 pool size, lock wait, `lock_timeout` 변화에 따라 어떤 운영 한계를 보이는지 확인한다.

## Target

- Atomic Conditional Update pool size별 처리량과 p95/p99
- Pessimistic Lock pool size별 lock wait와 p99 지연
- Pessimistic Lock `lock_timeout` 적용 시 HTTP 응답 분포와 정합성
- 각 실험 후 Seat Count Inconsistency와 Overbooking 검증

## Out of Scope

- Deadlock 유발 실험
- `statement_timeout` 정책 검증
- Redis 장애 실험
- WireMock 외부 API 지연 실험
- Kafka/Outbox

## Completion Gate

- [ ] Atomic Conditional Update pool size별 k6 결과를 저장했다.
- [ ] Pessimistic Lock pool size별 k6 결과를 저장했다.
- [ ] Pessimistic Lock의 `pg_locks`, `pg_stat_activity` lock wait evidence를 저장했다.
- [ ] `lock_timeout` 값별 HTTP 응답 분포와 p95/p99 결과를 저장했다.
- [ ] 각 실험 후 consistency SQL 결과를 저장했다.
- [ ] `report.md`에 DB pool/timeout 운영 기준을 기록했다.
```

- [ ] **Step 2: Update runbook**

Modify `docs/phases/04-db-operational-limits/runbook.md` to include exact commands for:

- common setup
- Atomic pool matrix
- Pessimistic pool matrix
- Pessimistic timeout matrix
- Grafana capture policy
- lock wait snapshots

Use these command patterns:

```bash
make server-start POOL_SIZE=10
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-10 PRESET=phase4-atomic-pool POOL=10 CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

For timeout runs, use:

```bash
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-500
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
```

- [ ] **Step 3: Update observability doc**

Modify `docs/phases/04-db-operational-limits/observability.md` so the Metrics table contains:

```markdown
| Area | Metric | Purpose |
|---|---|---|
| PostgreSQL | pg_locks | lock wait 확인 |
| PostgreSQL | pg_stat_activity | blocking query 확인 |
| Spring | hikaricp_connections_active | 커넥션 점유 |
| Spring | hikaricp_connections_pending | 커넥션 대기 |
| Spring | hikaricp_connections_max | 적용된 pool size 확인 |
| k6 | p99 | tail latency 악화 확인 |
| k6 | status distribution | `reserved`, `sold_out`, `lock_timeout` 응답 분포 확인 |
```

Add this note:

```markdown
`SHOW lock_timeout`은 현재 SQL session의 설정만 보여준다. Hikari `connection-init-sql`로 설정한 값은 애플리케이션 connection에 적용되므로, psql session에서 항상 같은 값이 보인다고 가정하지 않는다.
```

- [ ] **Step 4: Update report template**

Modify `docs/phases/04-db-operational-limits/report.md` so it has three result sections:

```markdown
## Atomic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | |

## Pessimistic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Lock Wait Evidence | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---|---:|---:|---|
| | | | | | | | | |

## Pessimistic Timeout Result

| Lock Timeout Setting | Reserved | Sold Out | Lock Timeout Responses | p95 | p99 | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | | |
```

- [ ] **Step 5: Update commands guide**

Modify `docs/guides/commands.md`:

Add common variables:

```markdown
| `POOL_SIZE` | `10` | Spring Boot 서버의 HikariCP maximum pool size |
| `LOCK_TIMEOUT` | `0` | Spring Boot 서버 connection의 PostgreSQL lock timeout. 숫자만 쓰며 단위는 ms |
```

Add server example:

```bash
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

Add Phase 4 SQL evidence examples:

```bash
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
```

- [ ] **Step 6: Update project format standard**

Modify `docs/guides/project-format-standard.md`:

- Add `POOL_SIZE`, `LOCK_TIMEOUT`, and `EXPERIMENT` to the variable table.
- Add `sql-consistency` and `phase4-sql-consistency` to supported targets.
- Update `server-start` optional variables to include `POOL_SIZE` and `LOCK_TIMEOUT`.

- [ ] **Step 7: Verify docs**

Run:

```powershell
rg -n "04-db-limits|DB Limit Experiments" docs k6 Makefile scripts
```

Expected: no matches.

Run:

```powershell
git diff --check
```

Expected: exit code `0`.

- [ ] **Step 8: Commit**

```powershell
git add docs/phases/04-db-operational-limits/scope.md `
        docs/phases/04-db-operational-limits/runbook.md `
        docs/phases/04-db-operational-limits/observability.md `
        docs/phases/04-db-operational-limits/report.md `
        docs/guides/commands.md `
        docs/guides/project-format-standard.md
git commit -m "docs: align phase4 operational limits runbook"
```
