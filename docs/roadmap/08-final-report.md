# Phase 8. Final Report

## Goal

전체 실험 결과를 바탕으로 통합 이커머스/결제 프로젝트에 적용할 동시성 전략을 결정한다.

## Key Questions

- 좌석/재고 차감에는 어떤 전략이 적합한가?
- 중복 요청 방지는 DB 제약과 idempotency key 중 어디까지 필요한가?
- Redis 전략을 도입할 만한 트래픽/충돌 조건은 무엇인가?
- 결제 프로젝트로 넘겨야 할 보상, Outbox, webhook 주제는 무엇인가?

## Completion Criteria

- 전체 방식별 비교표 완성
- 방식별 정합성, RPS, p95, p99, 실패율, 운영 복잡도 기록
- 통합 프로젝트 적용 전략 작성
- 남겨둘 질문과 후속 프로젝트 범위 정리

## Phase Docs

- [Phase Hub](../phases/08-final-report/README.md)
