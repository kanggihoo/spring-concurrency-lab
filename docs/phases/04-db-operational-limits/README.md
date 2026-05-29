# Phase 4. DB Operational Limits

## Status

Hardened with timeout limitation

## Goal

Phase 3에서 확인한 DB 기반 Reservation 전략을 pool size, row lock wait, `lock_timeout` 변화에 따라 비교하고 운영 한계를 수치로 확인한다.

## Documents

- [Scope](./scope.md)
- [Runbook](./runbook.md)
- [Observability](./observability.md)
- [Report](./report.md)

## Evidence

- [Atomic Pool](../../evidence/04-db-operational-limits/atomic-pool)
- [Pessimistic Pool](../../evidence/04-db-operational-limits/pessimistic-pool)
- [Pessimistic Timeout](../../evidence/04-db-operational-limits/pessimistic-timeout)
