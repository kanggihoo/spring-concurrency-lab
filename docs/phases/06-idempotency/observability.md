# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| App | duplicate request count | 중복 요청 차단 수 |
| SQL | reservation count by user | 중복 생성 여부 확인 |
| k6 | error rate | 중복 차단 응답 영향 |
| k6 | p95 / p99 | 멱등성 처리 지연 |

## SQL

```sql
SELECT concert_id, user_id, COUNT(*)
FROM reservation
GROUP BY concert_id, user_id
HAVING COUNT(*) > 1;
```
