# Report

## Summary

Phase 5에서는 Phase 4에서 기본 DB 전략으로 남긴 **Atomic Conditional Update**를 기준선으로 두고, Redis를 사용하는 두 가지 전략을 같은 부하 조건에서 비교했다.

- **Atomic Conditional Update**: DB의 `remaining_seats > 0` 조건부 update로 좌석을 차감하고 Reservation을 저장한다.
- **Redisson Lock**: Redis 분산락으로 Concert 단위 예약 경로를 직렬화한 뒤 DB Atomic Conditional Update로 최종 저장한다.
- **Redis Lua Atomic Decrement**: Redis Lua script로 Redis Remaining Seats를 먼저 원자 차감하고, DB 저장 실패 시 Redis 값을 보상 복구한다.

모든 측정은 Concert 1, Initial Seat Count 100, k6 100 VUs, 10초 지속 부하로 수행했다. k6는 예약 성공 응답 `reserved`, 매진 응답 `sold_out`, Redisson lock 획득 실패 `lock_acquire_failed`, Redis/DB 동기화 실패 `redis_db_sync_failed`를 별도 counter로 기록했다. 최종 정합성은 SQL consistency evidence와 Redis Remaining Seats snapshot으로 확인했다.

측정 결과, 세 전략 모두 DB 기준 counted-seat invariant를 지켰다. 최종 상태는 Reservation 100건, DB Remaining Seats 0, Seat Count Inconsistency 0, Overbooking false였다. 차이는 정합성이 아니라 처리량, tail latency, 실패 응답의 의미, 운영 복잡도에서 나타났다.

Redis Lua는 가장 높은 RPS와 가장 낮은 p95를 보였다. 이유는 좌석 100개가 소진된 뒤 대부분의 요청을 Redis에서 빠르게 `sold_out`으로 거절했기 때문이다. Redisson Lock은 정합성을 지켰지만, lock wait 설정 때문에 고경합 상황에서 `lock_acquire_failed`가 많이 발생했고 처리량도 가장 낮았다. Atomic Conditional Update는 Redis 전략보다 구조가 단순하고 DB만으로 일관된 결과를 만들었다.

측정값 출처는 다음과 같다.

- RPS, p95, Error Rate, 응답 status counter는 k6 summary JSON에서 읽었다.
- p99는 k6 summary export에 포함되지 않으므로 Prometheus remote-write metric `k6_http_req_duration_p99`를 Phase 5 label 기준으로 조회해 별도 evidence 파일에 저장했다.
- DB 정합성은 `scripts/sql/consistency-check.sql` 결과를 저장한 `sql/consistency.txt`로 확인했다.
- Redis Remaining Seats는 `redis-cli GET concert:1:remaining-seats` 결과를 저장한 `redis/remaining-seats.txt`로 확인했다.

주의할 점이 있다. k6 summary의 p95는 전체 run aggregate이고, p99는 Prometheus remote-write의 시계열 값을 조회한 것이다. 집계 경로가 다르기 때문에 p99는 p95와 같은 표 안에서 직접적인 분위수 연속성으로 해석하기보다, 같은 Phase 5 run-window에서 관측된 tail latency 참고값으로 봐야 한다.

## Measurement Conditions

| 항목 | 값 |
|---|---|
| Date | 2026-05-28 |
| Workload | 100 VUs, 10s, `constant-vus` |
| Concert ID | 1 |
| Initial Seat Count | 100 |
| k6 base URL | `http://host.docker.internal:8080` |
| App port | 8080 |
| Observability | Prometheus remote write, Redis exporter, PostgreSQL exporter, Grafana |
| Redis key | `concert:1:remaining-seats` |

## Strategy Comparison

| Strategy | RPS | p95 | p99 | Error Rate | Reserved | Sold Out | Lock Acquire Failed | Redis/DB Sync Failed | Consistency | Evidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Atomic Conditional Update pool 10 | 1211.71 req/s | 151.37 ms | [773.45 ms](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/prometheus/http-req-duration-p99.txt) | 0.00% | 100 | 12,436 | 0 | 0 | PASS | [k6](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-10-20260528-103145-summary.json), [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/sql/consistency.txt) |
| Atomic Conditional Update pool 50 | 1337.19 req/s | 109.60 ms | [956.82 ms](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/prometheus/http-req-duration-p99.txt) | 0.00% | 100 | 14,161 | 0 | 0 | PASS | [k6](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-50-20260528-103247-summary.json), [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/sql/consistency.txt) |
| Redisson Lock | 555.21 req/s | 218.72 ms | [364.64 ms](../../evidence/05-redis-strategies/redisson-lock/baseline/prometheus/http-req-duration-p99.txt) | 0.00% | 100 | 1,475 | 4,347 | 0 | PASS | [k6](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json), [SQL](../../evidence/05-redis-strategies/redisson-lock/baseline/sql/consistency.txt), [Redis](../../evidence/05-redis-strategies/redisson-lock/baseline/redis/remaining-seats.txt) |
| Redis Lua Atomic Decrement | 3547.25 req/s | 44.38 ms | [1409.77 ms](../../evidence/05-redis-strategies/redis-lua/baseline/prometheus/http-req-duration-p99.txt) | 0.00% | 100 | 36,414 | 0 | 0 | PASS | [k6](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json), [SQL](../../evidence/05-redis-strategies/redis-lua/baseline/sql/consistency.txt), [Redis](../../evidence/05-redis-strategies/redis-lua/baseline/redis/remaining-seats.txt) |

## Atomic Conditional Update Baseline

Atomic Conditional Update는 DB row 하나에 대해 다음 조건을 만족할 때만 Remaining Seats를 차감한다.

```sql
UPDATE concert
SET remaining_seats = remaining_seats - 1
WHERE id = ?
  AND remaining_seats > 0
```

이 방식은 DB가 durable source of truth가 된다. Redis가 없어도 Reservation 저장과 Remaining Seats 차감의 최종 정합성을 DB transaction 안에서 확인할 수 있다. Phase 5에서는 이 전략을 pool 10과 pool 50으로 다시 측정했다.

| Pool Size | RPS | p95 | p99 | Reserved | Sold Out | Reservation Count | Remaining Seats | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 10 | 1211.71 req/s | 151.37 ms | [773.45 ms](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/prometheus/http-req-duration-p99.txt) | 100 | 12,436 | 100 | 0 | 0 | false | [k6](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-10-20260528-103145-summary.json), [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/sql/consistency.txt) |
| 50 | 1337.19 req/s | 109.60 ms | [956.82 ms](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/prometheus/http-req-duration-p99.txt) | 100 | 14,161 | 100 | 0 | 0 | false | [k6](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-50-20260528-103247-summary.json), [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/sql/consistency.txt) |

pool 50은 pool 10보다 RPS가 높고 p95가 낮았다. 다만 p99는 pool 50이 더 높았다. 이것은 전체 요청 대부분이 빠른 sold-out 응답으로 수렴하는 workload에서 일부 긴 요청이 Prometheus p99에 크게 반영된 결과로 볼 수 있다.

Atomic baseline의 핵심 해석은 단순하다. 이 전략은 Redis 없이도 정합성을 지켰고, 실패 응답은 모두 정상적인 매진 응답으로 분류됐다. 운영 관점에서는 구성 요소가 가장 적고 장애 도메인도 DB로 한정된다.

## Redisson Lock Result

Redisson Lock 전략은 Redis를 Remaining Seats 저장소로 사용하지 않는다. Redis는 Concert 단위 lock coordinator 역할만 한다. lock을 획득한 요청만 DB Atomic Conditional Update를 실행하고 Reservation을 저장한다.

이번 측정에서 Redisson Lock은 최종 DB 정합성을 지켰다. Reservation Count는 100, DB Remaining Seats는 0, Seat Count Inconsistency는 0이었다. 하지만 k6 응답 분포에서 `lock_acquire_failed`가 4,347건 발생했다.

| Metric | Value | Evidence |
|---|---:|---|
| RPS | 555.21 req/s | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| p95 | 218.72 ms | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| p99 | 364.64 ms | [Prometheus p99](../../evidence/05-redis-strategies/redisson-lock/baseline/prometheus/http-req-duration-p99.txt) |
| Reserved | 100 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| Sold Out | 1,475 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| Lock Acquire Failed | 4,347 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| Redis Remaining Seats | 100 | [Redis snapshot](../../evidence/05-redis-strategies/redisson-lock/baseline/redis/remaining-seats.txt) |
| DB Consistency | PASS | [SQL](../../evidence/05-redis-strategies/redisson-lock/baseline/sql/consistency.txt) |

Redisson의 Redis Remaining Seats snapshot이 100인 것은 정상이다. 이 전략은 Redis Remaining Seats를 차감하지 않고, `/api/test/reset`이 Redis Remaining Seats를 100으로 초기화한 뒤 lock key만 사용한다. 따라서 Redisson 전략에서 Redis Remaining Seats 값은 DB 정합성의 기준이 아니라 “Redis 좌석 게이트를 사용하지 않았다”는 관측 결과로 해석해야 한다.

Redisson Lock의 장점은 명확한 직렬화다. 여러 인스턴스가 같은 Concert에 접근하더라도 Redis lock을 통해 진입을 제한할 수 있다. 그러나 이번 workload처럼 같은 Concert 하나에 100 VU가 몰리는 경우에는 lock 획득 자체가 병목이 된다. `reservation.redis.lock-wait-ms`를 짧게 유지하면 긴 대기 대신 빠른 `lock_acquire_failed`를 반환한다. 이는 DB 정합성 실패는 아니지만 사용자 경험과 처리량에는 직접적인 손실이다.

따라서 Redisson Lock은 단순 counted-seat decrement의 기본 전략으로 보기 어렵다. 이미 DB Atomic Conditional Update가 같은 정합성을 더 단순하게 보장한다면, Redis lock은 “DB update만으로 표현하기 어려운 여러 리소스의 임계구역”이 있을 때 별도로 검토하는 편이 맞다.

## Redis Lua Atomic Decrement Result

Redis Lua 전략은 Redis Remaining Seats를 빠른 gate로 사용한다. Lua script는 Redis key를 읽고, 값이 없거나 0 이하이면 실패를 반환한다. 값이 1 이상이면 Redis에서 먼저 `DECR`을 수행한다. 이후 DB Atomic Conditional Update와 Reservation 저장을 실행한다.

이 전략은 이번 측정에서 가장 높은 RPS와 가장 낮은 p95를 보였다.

| Metric | Value | Evidence |
|---|---:|---|
| RPS | 3547.25 req/s | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| p95 | 44.38 ms | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| p99 | 1409.77 ms | [Prometheus p99](../../evidence/05-redis-strategies/redis-lua/baseline/prometheus/http-req-duration-p99.txt) |
| Reserved | 100 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| Sold Out | 36,414 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| Redis/DB Sync Failed | 0 | [k6 summary](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| Redis Remaining Seats | 0 | [Redis snapshot](../../evidence/05-redis-strategies/redis-lua/baseline/redis/remaining-seats.txt) |
| DB Consistency | PASS | [SQL](../../evidence/05-redis-strategies/redis-lua/baseline/sql/consistency.txt) |

RPS가 높은 이유는 대부분의 요청이 좌석 소진 이후 Redis에서 바로 `sold_out`으로 종료되었기 때문이다. DB에는 성공 가능한 100건만 주로 도달한다. 따라서 Redis Lua는 sold-out 이후의 DB 부하를 크게 줄일 수 있다.

다만 p99가 1409.77 ms로 높게 잡혔다. k6 summary의 p95는 44.38 ms로 매우 낮지만, Prometheus p99는 성공 예약 초기에 발생한 긴 요청 tail을 더 크게 반영한 것으로 보인다. 이 결과는 “대부분의 sold-out 요청은 매우 빠르지만, Redis 차감 후 DB까지 쓰는 성공 경로는 여전히 tail latency를 만들 수 있다”는 뜻으로 해석하는 것이 맞다.

Redis Lua의 운영상 핵심 비용은 보상 처리다. Redis 차감은 성공했지만 DB 저장이 실패하면 Redis Remaining Seats를 되돌려야 한다. 이 경로는 `RedisLuaCompensationTest`로 검증했고, 정상 k6 성능 측정에서는 `redis_db_sync_failed`가 발생하지 않았다. 그러나 실제 운영에서는 이 counter가 0으로 유지되는지 반드시 관측해야 한다.

## Compensation Result

| Scenario | Result | Evidence |
|---|---|---|
| Redis decrement success, DB save failure | PASS | [RedisLuaCompensationTest](../../../concurrency/src/test/java/com/example/concurrency/RedisLuaCompensationTest.java) |

보상 테스트는 `DbReservationWriter`를 mock 처리해 DB 저장 실패를 강제로 만들었다. Redis Lua가 Remaining Seats를 1에서 0으로 차감한 뒤 DB 실패가 발생하면 `compensateDecrement()`가 실행되어 Redis Remaining Seats가 다시 1로 복구된다. 이 테스트는 Redis Lua 전략을 운영 전략으로 고려할 때 최소한의 안전장치다.

## Consistency Result

| Strategy | Reservation Count | Remaining Seats | Seat Count Inconsistency | Overbooking | Redis Remaining Seats | Evidence |
|---|---:|---:|---:|---|---:|---|
| Atomic Conditional Update pool 10 | 100 | 0 | 0 | false | N/A | [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/sql/consistency.txt) |
| Atomic Conditional Update pool 50 | 100 | 0 | 0 | false | N/A | [SQL](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/sql/consistency.txt) |
| Redisson Lock | 100 | 0 | 0 | false | 100 | [SQL](../../evidence/05-redis-strategies/redisson-lock/baseline/sql/consistency.txt), [Redis](../../evidence/05-redis-strategies/redisson-lock/baseline/redis/remaining-seats.txt) |
| Redis Lua Atomic Decrement | 100 | 0 | 0 | false | 0 | [SQL](../../evidence/05-redis-strategies/redis-lua/baseline/sql/consistency.txt), [Redis](../../evidence/05-redis-strategies/redis-lua/baseline/redis/remaining-seats.txt) |

네 조건 모두 DB 기준 counted-seat invariant를 만족했다.

```text
reservation_count + remaining_seats = initial_seat_count
100 + 0 = 100
```

Redisson Lock의 Redis Remaining Seats가 100인 것은 불일치가 아니다. Redisson 전략은 Redis Remaining Seats를 예약 판단에 사용하지 않는다. Redis Lua의 Redis Remaining Seats가 0인 것은 Redis gate와 DB 최종 상태가 같은 방향으로 수렴했다는 의미다.

## Evidence Inventory

| Evidence | Path |
|---|---|
| Atomic pool 10 k6 summary | [phase5-atomic-baseline-prometheus-atomic-pool-10-20260528-103145-summary.json](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-10-20260528-103145-summary.json) |
| Atomic pool 50 k6 summary | [phase5-atomic-baseline-prometheus-atomic-pool-50-20260528-103247-summary.json](../../evidence/05-redis-strategies/k6/phase5-atomic-baseline-prometheus-atomic-pool-50-20260528-103247-summary.json) |
| Redisson k6 summary | [phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json](../../evidence/05-redis-strategies/k6/phase5-redisson-lock-prometheus-baseline-20260528-103357-summary.json) |
| Redis Lua k6 summary | [phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json](../../evidence/05-redis-strategies/k6/phase5-redis-lua-prometheus-baseline-20260528-103429-summary.json) |
| Atomic pool 10 SQL | [consistency.txt](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/sql/consistency.txt) |
| Atomic pool 50 SQL | [consistency.txt](../../evidence/05-redis-strategies/atomic-baseline/atomic-pool-50/sql/consistency.txt) |
| Redisson SQL | [consistency.txt](../../evidence/05-redis-strategies/redisson-lock/baseline/sql/consistency.txt) |
| Redis Lua SQL | [consistency.txt](../../evidence/05-redis-strategies/redis-lua/baseline/sql/consistency.txt) |
| Redisson Redis snapshot | [remaining-seats.txt](../../evidence/05-redis-strategies/redisson-lock/baseline/redis/remaining-seats.txt) |
| Redis Lua Redis snapshot | [remaining-seats.txt](../../evidence/05-redis-strategies/redis-lua/baseline/redis/remaining-seats.txt) |

## Findings

첫째, Atomic Conditional Update는 여전히 가장 단순한 기본 전략이다. Redis 없이 DB row update와 Reservation insert만으로 최종 정합성을 지킨다. pool 10과 pool 50 모두 Reservation 100건, Remaining Seats 0, Seat Count Inconsistency 0을 기록했다. 운영 구성 요소가 적고, Redis 장애나 Redis/DB 보상 문제를 고려하지 않아도 된다.

둘째, Redisson Lock은 정합성은 지켰지만 처리량이 낮았다. 이번 측정에서 Redisson은 555.21 req/s로 Atomic pool 10의 1211.71 req/s보다 낮았다. lock을 얻지 못한 요청 4,347건은 HTTP failure가 아니라 예상된 409 응답으로 분류되었지만, 실제 사용자 관점에서는 예약 시도가 빠르게 실패한 것이다. Redisson Lock은 DB 정합성 보장을 위해 반드시 필요한 전략이라기보다, 여러 작업을 하나의 분산 임계구역으로 묶어야 할 때 선택할 수 있는 전략이다.

셋째, Redis Lua는 sold-out 이후 DB 부하를 줄이는 데 가장 효과적이었다. Redis Lua는 3547.25 req/s를 기록했고 p95도 44.38 ms로 가장 낮았다. 다만 이 수치는 대부분의 요청이 Redis에서 빠르게 `sold_out`으로 종료된 workload의 특성을 반영한다. 성공 예약 경로는 여전히 DB write를 포함하며, Prometheus p99에서 긴 tail이 관측됐다.

넷째, Redis Lua는 성능 이점 대신 보상 복잡도를 가져온다. Redis 차감 성공 후 DB 저장이 실패하면 Redis 값을 되돌려야 한다. 이번 구현은 이 경로를 `RedisLuaCompensationTest`로 검증했고, 정상 부하 측정에서는 `redis_db_sync_failed`가 발생하지 않았다. 하지만 운영에서는 compensation counter와 Redis/DB consistency evidence가 필수다.

다섯째, 이번 Phase 5 결과는 “Redis를 쓰면 항상 더 낫다”가 아니라 “Redis가 어떤 실패와 운영 책임을 새로 만드는지”를 보여준다. Redisson은 lock 실패 응답을 만든다. Redis Lua는 Redis/DB 이중 상태와 보상 로직을 만든다. Atomic Conditional Update는 가장 높은 절대 처리량은 아니지만, 단일 DB source of truth라는 단순성을 유지한다.

## Decision

기본 Reservation 전략은 **DB Atomic Conditional Update**로 유지한다.

현재 도메인은 단일 Concert row의 Remaining Seats를 차감하고 Reservation을 저장하는 counted-seat model이다. 이 범위에서는 DB Atomic Conditional Update가 가장 단순하고 충분하다. 정합성을 DB 하나에서 보장할 수 있고, Redis 장애나 Redis/DB 보상 실패를 운영 리스크로 추가하지 않는다.

Redisson Lock은 기본 전략으로 채택하지 않는다. Redisson은 정합성을 지켰지만, 단일 row decrement 문제에서는 DB Atomic Conditional Update보다 복잡하고 느렸다. lock-acquire failure가 의미 있는 사용자 실패 응답으로 나타나므로, 운영에서 이 전략을 쓰려면 lock wait, lease time, retry 정책, lock failure UX를 별도로 설계해야 한다.

Redis Lua는 상황부 전략으로 둔다. sold-out 이후 DB 부하를 줄이는 효과는 분명하다. 특히 매우 높은 매진 후 요청이 들어오고, DB를 보호해야 하는 상황에서는 유효할 수 있다. 하지만 Redis Remaining Seats와 DB Remaining Seats라는 이중 상태를 운영해야 하며, DB 실패 시 보상 로직과 compensation monitoring이 반드시 필요하다. Redis Lua를 기본 전략으로 올리려면 다음 조건이 추가로 충족되어야 한다.

- `reservation.redis.compensation` counter가 정상 부하에서 0으로 유지되는지 관측한다.
- Redis Remaining Seats와 DB consistency SQL을 모든 측정 run마다 함께 저장한다.
- Redis 장애, Redis key missing, DB write 실패, 보상 실패에 대한 runbook을 별도로 둔다.
- 성공 예약 경로의 tail latency를 더 긴 duration과 더 다양한 Concert 분포에서 재측정한다.

따라서 Phase 5의 결론은 다음과 같다.

> 단일 Concert Remaining Seats 차감과 Reservation insert만 있는 현재 범위에서는 DB Atomic Conditional Update를 기본 전략으로 유지한다. Redisson Lock과 Redis Lua는 운영상 이유가 명확할 때만 선택하는 보조 전략으로 둔다.

## Next Phase Input

Phase 6에서는 counted-seat invariant가 보호된 상태를 전제로, 중복 요청과 idempotency를 검증해야 한다.

특히 같은 User가 같은 Concert에 여러 번 요청하는 경우를 분리해서 다뤄야 한다. Phase 5까지는 “총 좌석 수를 초과하지 않는가”를 중심으로 검증했다. Phase 6에서는 “같은 User가 중복 Reservation을 만들지 않는가”, “재시도 요청이 같은 결과로 수렴하는가”, “결제나 외부 API와 연결될 때 idempotency key를 어떻게 관리할 것인가”를 검증해야 한다.
