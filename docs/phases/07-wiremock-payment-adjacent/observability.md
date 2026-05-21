# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | p95 / p99 | 외부 API 지연 영향 |
| Spring | Hikari active/pending | 트랜잭션 점유 영향 |
| App | lock hold time | 외부 호출 위치 영향 |
| WireMock | request count | Fake PG 호출 수 |
| App | external call failure count | 외부 API 실패 영향 |

## Interpretation

lock 안에서 외부 API 호출 시 p99와 connection pending이 증가하면, 결제 프로젝트에서는 예약/결제 경계를 분리해야 한다는 근거로 사용한다.
