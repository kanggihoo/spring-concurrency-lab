# Phase 2. No Lock Baseline

## Goal

락 없는 예약 구현에서 lost update와 seat count inconsistency를 재현하고 기준 성능을 측정한다.

## Key Questions

- 예약 수와 차감된 재고가 불일치하는가?
- 정합성이 깨진 상태에서 RPS, p95, p99는 어느 수준인가?
- 동시성 처리가 필요한 이유를 테스트와 수치로 설명할 수 있는가?

## Completion Criteria

- Testcontainers 동시성 테스트로 inconsistency 재현
- k6 baseline, spike, ramp-up 중 최소 1개 이상 실행
- 정합성 검증 SQL 결과 저장
- `docs/phases/02-no-lock-baseline/report.md`에 baseline 수치 기록

## Phase Docs

- [Phase Hub](../phases/02-no-lock-baseline/README.md)
