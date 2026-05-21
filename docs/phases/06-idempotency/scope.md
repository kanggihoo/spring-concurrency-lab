# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

같은 예약 요청이 반복되어도 예약이 중복 생성되지 않도록 검증한다.

## Target

- `UNIQUE(concert_id, user_id)`
- Idempotency-Key table 후보
- timeout 후 재시도 시나리오

## Out of Scope

- 실제 PG 결제 연동
- webhook 중복 처리
- Kafka/Outbox

## Completion Gate

- [ ] 같은 사용자 중복 예약 테스트를 통과했다.
- [ ] 같은 request key 중복 요청 테스트를 통과했다.
- [ ] unique constraint와 idempotency key의 차이를 기록했다.
- [ ] 결제 프로젝트로 넘길 멱등성 인사이트를 정리했다.
