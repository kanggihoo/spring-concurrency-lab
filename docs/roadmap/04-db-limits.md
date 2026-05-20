# Phase 4. DB Limit Experiments

## Goal

DB 기반 동시성 제어가 어떤 조건에서 느려지거나 실패하는지 확인한다.

## Experiments

- Lock wait 관찰
- Deadlock 유발과 탐지
- HikariCP connection pool tuning
- `lock_timeout`, `statement_timeout` 정책 검토

## Key Questions

- 커넥션 풀을 키우면 성능이 계속 좋아지는가?
- 데드락은 어떤 락 순서에서 발생하는가?
- lock wait과 p99 지연은 어떤 관계가 있는가?

## Completion Criteria

- lock wait 또는 deadlock evidence 저장
- pool size별 k6 결과 저장
- PostgreSQL `pg_locks`, `pg_stat_activity` 관측 결과 기록
- `docs/phases/04-db-limits/report.md`에 DB 한계와 운영 기준 기록

## Phase Docs

- [Phase Hub](../phases/04-db-limits/README.md)
