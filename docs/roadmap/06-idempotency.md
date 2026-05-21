# Phase 6. Idempotency

## Goal

같은 사용자나 같은 요청이 반복 전송되어도 중복 예약이 생성되지 않도록 한다.

## Key Questions

- `UNIQUE(concert_id, user_id)`만으로 중복 예약을 충분히 막을 수 있는가?
- 클라이언트 timeout 후 재시도 상황을 어떻게 판정할 것인가?
- Idempotency-Key 테이블이 필요한 상황은 언제인가?

## Completion Criteria

- 중복 사용자 요청 테스트 통과
- 중복 request key 실험 결과 기록
- DB unique constraint와 idempotency table 방식의 차이 정리
- `docs/phases/06-idempotency/report.md`에 결제 프로젝트로 넘길 인사이트 기록

## Phase Docs

- [Phase Hub](../phases/06-idempotency/README.md)
