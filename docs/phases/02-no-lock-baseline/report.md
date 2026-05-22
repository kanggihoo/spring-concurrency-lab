# Report

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Summary

Measured on the Phase 2 no-lock baseline flow with Grafana provisioning, k6
Prometheus remote write, SQL evidence, and Grafana capture enabled.

## k6 Result

| Scenario | VU | RPS | p95 | p99 | Error Rate | Evidence |
|---|---:|---:|---:|---:|---:|---|
| baseline | 100 | ~1,219 req/s | not emitted by current remote-write series | 0.649 s | 0.00% after marking 200/409 expected | Prometheus `k6_http_reqs_total`, `k6_http_req_failed_rate`, `k6_http_req_duration_p99`; Grafana capture parts |

## Consistency Result

| reservation_count | deducted_seats | seat_count_inconsistency | Evidence |
|---:|---:|---:|---|
| 1132 | 100 | 1032 | `docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt`; `k6_concert_seat_count_inconsistency=1032` |

## Findings

- The no-lock baseline produced Seat Count Inconsistency: 1132 successful
  reservations were recorded while Remaining Seats reached 0 from an Initial
  Seat Count of 100.
- Overbooking was observed in raw SQL evidence.
- k6 originally counted expected `409 sold out` reservation responses as failed
  HTTP responses. The scripts now mark `200` and `409` as expected reservation
  outcomes, so the post-fix baseline completed with `http_req_failed=0.00%`.
- Grafana dashboard capture completed and wrote three screenshot parts plus
  `capture-meta.json`.

## Decision

Use this run as Phase 2 no-lock baseline evidence. Phase 3 comparisons should
focus on reducing Seat Count Inconsistency and Overbooking while keeping latency
and request throughput visible in Grafana.

## Next Phase Input

Phase 3에서 DB 기반 해결책과 비교할 baseline 수치를 넘긴다.
