# Roadmap Overview

이 로드맵은 콘서트 예약이라는 한정 자원 시나리오에서 동시성 제어 전략을 비교하기 위한 실행 순서를 정의한다.

## Core Question

한정된 좌석을 다수 사용자가 동시에 예약할 때, 어떤 방식이 정합성, 처리량, 지연 시간, 운영 복잡도 측면에서 적합한가?

## Phase Order

| Phase | Name | Main Question |
|---:|---|---|
| 1 | Environment & Observability | 측정 가능한 환경이 준비되었는가? |
| 2 | No Lock Baseline | 락이 없으면 어떤 정합성 문제가 발생하는가? |
| 3 | DB Concurrency Strategies | DB만으로 어디까지 안전하고 빠르게 처리할 수 있는가? |
| 4 | DB Operational Limits | DB 기반 Reservation 전략의 pool, lock wait, timeout 한계는 어디서 드러나는가? |
| 5 | Redis Concurrency Strategies | Redis 기반 전략은 DB 전략 대비 어떤 장단점이 있는가? |
| 6 | Idempotency | 중복 요청과 클라이언트 재시도를 어떻게 막을 것인가? |
| 7 | WireMock Payment-Adjacent Experiment | 외부 API 지연이 락과 트랜잭션에 어떤 영향을 주는가? |
| 8 | Final Report | 통합 프로젝트에는 어떤 전략을 적용할 것인가? |

## Progress Rule

각 Phase는 `docs/phases/<phase>/report.md`에 수치 기반 결론이 기록되기 전까지 완료로 보지 않는다.
