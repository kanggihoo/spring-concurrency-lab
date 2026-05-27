# Phase 4. DB Operational Limits

## Status

Planned

## Goal

Phase 3에서 확인한 DB 기반 Reservation 전략이 pool size, lock wait, `lock_timeout` 변화에 따라 어떤 운영 한계를 보이는지 수치로 확인한다.

## Documents

- [Scope](./scope.md)
- [Runbook](./runbook.md)
- [Observability](./observability.md)
- [Report](./report.md)

## Evidence

- [Atomic Pool](../../evidence/04-db-operational-limits/atomic-pool)
- [Pessimistic Pool](../../evidence/04-db-operational-limits/pessimistic-pool)
- [Pessimistic Timeout](../../evidence/04-db-operational-limits/pessimistic-timeout)
