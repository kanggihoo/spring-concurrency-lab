# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Aggregated Metrics

| Metric | Purpose |
|---|---|
| RPS | 처리량 비교 |
| p95 / p99 | 지연 시간 비교 |
| error rate | 안정성 비교 |
| inconsistency | 정합성 비교 |
| retry count | 낙관적 락 비용 |
| lock wait | DB 락 영향 |
| Hikari active/pending | 커넥션 풀 영향 |
| Redis latency | Redis 전략 영향 |

## Evidence

각 Phase의 evidence를 직접 복사하지 않고 링크로 연결한다.
