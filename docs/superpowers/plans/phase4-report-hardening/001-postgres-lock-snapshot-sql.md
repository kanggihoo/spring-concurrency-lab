# 001. PostgreSQL Lock Snapshot SQL 분리

### Task 001: inline lock SQL을 재사용 가능한 SQL 파일로 분리

**Files:**
- Create: `scripts/sql/pg-lock-wait-snapshot.sql`
- Create: `scripts/sql/pg-lock-summary.sql`
- Modify: `docs/phases/04-db-operational-limits/runbook.md`
- Modify: `docs/phases/04-db-operational-limits/observability.md`

- [ ] **Step 1: blocker 정보를 포함한 wait snapshot SQL을 만든다**

Create `scripts/sql/pg-lock-wait-snapshot.sql`:

```sql
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
```

- [ ] **Step 2: lock count summary SQL을 만든다**

Create `scripts/sql/pg-lock-summary.sql`:

```sql
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
```

- [ ] **Step 3: SQL 파일 문법을 검증한다**

PostgreSQL이 떠 있는 상태에서 실행한다.

Run:

```powershell
docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-wait-snapshot.sql

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-summary.sql
```

Expected: SQL syntax error가 없다. 부하가 없는 상태에서는 `pg-lock-wait-snapshot.sql` 결과가 0 row일 수 있다.

- [ ] **Step 4: Phase 4 runbook의 Lock Wait Snapshots 절을 갱신한다**

`docs/phases/04-db-operational-limits/runbook.md`의 inline `SELECT ... FROM pg_locks` 명령을 SQL 파일 기반 명령으로 바꾼다.

삽입할 명령 예시:

```powershell
New-Item -ItemType Directory -Force docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-wait-snapshot.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-summary.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt
```

`pool-50` 예시도 같은 형식으로 추가한다.

- [ ] **Step 5: Observability 문서에 새 SQL evidence를 기록한다**

`docs/phases/04-db-operational-limits/observability.md`의 SQL 섹션에 아래 내용을 추가한다.

```markdown
## PostgreSQL Lock Evidence

- `scripts/sql/pg-lock-wait-snapshot.sql`: `pg_stat_activity`에서 wait event, query age, transaction age, blocking PID를 저장한다.
- `scripts/sql/pg-lock-summary.sql`: `pg_locks`를 lock type, relation, mode, granted별 count로 요약한다.

Pessimistic Lock 대표 조건인 `pool-10`, `pool-50` 실행 중 별도 터미널에서 캡처한다.
```

- [ ] **Step 6: 문서와 SQL diff를 검증한다**

Run:

```powershell
git diff --check
```

Expected: exit code `0`.

- [ ] **Step 7: Commit**

```powershell
git add scripts/sql/pg-lock-wait-snapshot.sql `
        scripts/sql/pg-lock-summary.sql `
        docs/phases/04-db-operational-limits/runbook.md `
        docs/phases/04-db-operational-limits/observability.md
git commit -m "docs: add reusable postgres lock evidence queries"
```
