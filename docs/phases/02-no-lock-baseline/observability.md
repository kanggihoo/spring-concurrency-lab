# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | RPS | 기준 처리량 |
| k6 | p95 / p99 | 기준 지연 시간 |
| k6 | error rate | 실패율 |
| k6 | `k6_http_reqs_total{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | baseline request count |
| k6 | `k6_http_req_duration_p95{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | k6 p95 latency from Prometheus remote write trend stats |
| k6 | `k6_http_req_duration_p99{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | k6 p99 latency from Prometheus remote write trend stats |
| k6 | `k6_concert_reservation_count{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | consistency snapshot reservation count |
| k6 | `k6_concert_remaining_seats{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | consistency snapshot remaining seats |
| k6 | `k6_concert_seat_count_inconsistency{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | consistency gap emitted through k6 Prometheus remote write |
| k6 | `k6_concert_overbooked{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"}` | overbooking flag emitted through k6 Prometheus remote write |
| SQL | reservation count | 생성된 예약 수 |
| SQL | deducted seats | 차감된 좌석 수 |
| SQL | inconsistency | 정합성 오류 크기 |
| Spring | Hikari active/pending | baseline DB 연결 사용량 |

## Prometheus Checks

```bash
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=sum(k6_http_reqs_total{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"})'
```

```bash
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=max(k6_concert_seat_count_inconsistency{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"})'
```

The custom consistency metrics are exported by k6 remote write with the `k6_` prefix.

## Consistency SQL

```sql
SELECT
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1) AS reservation_count,
    (SELECT 100 - remaining_seats FROM concert WHERE id = 1) AS deducted_seats,
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1)
        + (SELECT remaining_seats FROM concert WHERE id = 1)
        - 100 AS seat_count_inconsistency;
```
