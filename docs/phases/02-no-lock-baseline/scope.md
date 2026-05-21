# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

동시 예약에서 락이 없을 때 정합성이 깨지는 현상을 증명한다.

## Target

- `POST /api/reservations`
- `POST /api/test/reset`
- `concert.remainingSeats`
- `reservation`

## Out of Scope

- 락 기반 해결책
- Redis 기반 해결책
- 멱등성 키 처리

## Completion Gate

- [ ] no-lock 동시성 테스트가 있다.
- [ ] seat count inconsistency를 재현했다.
- [ ] k6 결과를 evidence에 저장했다.
- [ ] 정합성 검증 SQL 결과를 evidence에 저장했다.
- [ ] `report.md`에 baseline 수치를 기록했다.
