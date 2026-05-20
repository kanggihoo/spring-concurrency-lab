# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | RPS | 기준 처리량 |
| k6 | p95 / p99 | 기준 지연 시간 |
| k6 | error rate | 실패율 |
| SQL | reservation count | 생성된 예약 수 |
| SQL | stock deducted | 차감된 재고 |
| SQL | inconsistency | 정합성 오류 크기 |
| Spring | Hikari active/pending | baseline DB 연결 사용량 |

## Consistency SQL

```sql
SELECT
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1) AS reservation_count,
    (SELECT 100 - stock FROM concert WHERE id = 1) AS stock_deducted,
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1)
        - (SELECT 100 - stock FROM concert WHERE id = 1) AS inconsistency;
```
