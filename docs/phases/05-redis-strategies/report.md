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
| DB Connection Pool | Atomic baseline은 pool 10과 pool 50을 각각 측정했다. Redisson Lock과 Redis Lua 측정은 DB pool 10으로 고정했다. |
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

Redisson Lock 전략은 Redis를 Remaining Seats 저장소로 사용하지 않는다. Redis는 Concert 단위 lock coordinator 역할만 한다. lock을 획득한 요청만 DB Atomic Conditional Update를 실행하고 Reservation을 저장한다. 이번 Redisson 측정은 Atomic pool 10과 같은 DB connection pool 10 기준으로 수행했다.

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

Redisson 응답 status의 의미는 다음처럼 구분해야 한다.

| Status | Redis Lock | DB 접근 | 의미 |
|---|---|---|---|
| `reserved` | 획득 성공 | 실행 | lock을 얻은 뒤 DB Atomic Conditional Update가 성공해 Reservation을 저장했다. |
| `sold_out` | 획득 성공 | 실행 | lock을 얻은 뒤 DB Atomic Conditional Update를 실행했지만 `remaining_seats > 0` 조건이 실패했다. 즉 DB 기준으로 이미 매진이다. |
| `lock_acquire_failed` | 획득 실패 | 실행 안 함 | `reservation.redis.lock-wait-ms` 안에 Redis lock을 얻지 못했다. DB를 보지 않았기 때문에 그 시점에 좌석이 있었는지 없었는지는 알 수 없다. |

따라서 `lock_acquire_failed` 4,347건은 매진 응답이 아니다. 이 요청들은 Redis lock 앞에서 탈락했기 때문에 DB Remaining Seats를 확인하지 못했다. 좌석이 이미 없었을 수도 있지만, 아직 좌석이 남아 있었더라도 lock을 얻지 못해 예약 기회를 잃었을 수 있다. 현재 구현은 `redissonClient.getLock(...)`을 사용하며 strict FIFO fair lock이 아니므로, 먼저 도착한 요청이 timeout으로 실패하고 나중 요청이 lock release 타이밍을 만나 성공하는 상황도 가능하다.

이 상태를 정확히 구분하려면 Redis나 DB 중 하나에서 좌석 상태를 추가로 읽어야 한다. lock 실패 직후 DB를 read-only로 조회하면 참고 정보는 얻을 수 있지만, 조회 시점과 lock 실패 시점 사이에 상태가 바뀔 수 있어 “그 요청이 예약 가능했는가”를 완전히 증명하지는 못한다. Redis Lua처럼 Redis에도 Remaining Seats를 두면 Redis 단계에서 좌석 상태를 알 수 있지만, 그 대신 Redis/DB 이중 상태, DB 저장 실패 보상, Redis key 복구, compensation monitoring이 필수 운영 책임이 된다.

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

보상 조건은 "DB에 접근하는 동안 기다렸다"는 사실 자체가 아니다. Redis Lua가 `DECR`에 성공한 뒤 DB Atomic Conditional Update나 Reservation insert가 timeout, lock timeout, deadlock, connection timeout, constraint violation, transaction exception 같은 `RuntimeException`으로 끝났을 때 보상이 실행된다. DB row lock을 기다리다가 결국 update와 insert가 성공하면 예약은 정상 확정되고 Redis 보상은 발생하지 않는다. 반대로 DB row lock을 기다리다가 timeout으로 실패하면 Reservation row가 생성되지 않으므로 `compensateDecrement()`로 Redis Remaining Seats를 `+1` 복구해야 한다.

이번 Phase 5 측정에서는 `redis_db_sync_failed`가 0이었으므로, Redis Lua의 보상 경로는 성능 측정 중 실제로 발생하지 않았다. 따라서 이번 Redis Lua p99 tail은 보상 반복 때문에 생긴 결과로 보기는 어렵다. 더 그럴듯한 해석은 Redis가 초반 100개 요청을 빠르게 통과시킨 뒤, 이 성공 후보들이 DB pool 10과 단일 Concert row의 Atomic Conditional Update 및 Reservation insert 경로에 짧은 시간 안에 몰리면서 일부 요청 tail을 만든 것이다.

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

둘째, Redisson Lock은 정합성은 지켰지만 처리량이 낮았다. 이번 측정에서 Redisson은 DB pool 10 기준 555.21 req/s로 Atomic pool 10의 1211.71 req/s보다 낮았다. lock을 얻지 못한 요청 4,347건은 HTTP failure가 아니라 예상된 409 응답으로 분류되었지만, 실제 사용자 관점에서는 예약 시도가 빠르게 실패한 것이다. 또한 이 응답은 매진이 아니라 좌석 상태 미확인 상태다. Redisson Lock은 DB 정합성 보장을 위해 반드시 필요한 전략이라기보다, 여러 작업을 하나의 분산 임계구역으로 묶어야 할 때 선택할 수 있는 전략이다.

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

## Phase 5 Improvement Notes

Phase 5는 Redis 전략의 기본 비교에는 충분했지만, 운영 결정을 더 강하게 만들려면 다음 측정 개선이 필요하다.

첫째, p95와 p99의 출처를 통일해야 한다. 현재 p95는 k6 summary JSON에서 읽고, p99는 Prometheus remote-write metric에서 별도 조회했다. 두 값의 방향성은 참고할 수 있지만 같은 집계 경로의 분위수처럼 정밀하게 비교하기 어렵다. 다음 측정에서는 k6 `summaryTrendStats`에 `p(99)`를 추가해 p95와 p99를 같은 k6 summary에서 저장하거나, Prometheus `k6_http_req_duration_p95`와 `k6_http_req_duration_p99`를 같은 run-window query로 함께 저장해야 한다.

둘째, DB 접근 횟수를 추론이 아니라 metric으로 남겨야 한다. 이번 보고서에서는 status counter를 통해 Redisson의 DB 접근을 `reserved + sold_out = 1,575`, Redis Lua의 DB 접근을 `reserved + redis_db_sync_failed = 100`으로 추론했다. 다음에는 `DbReservationWriter`에 `db_reservation_attempt`, `db_reservation_success`, `db_reservation_sold_out`, `db_reservation_failure` counter를 추가해 전략별 DB 진입 수를 직접 측정하는 편이 좋다.

셋째, Redis Lua는 좌석 수를 바꿔 다시 측정해야 한다. 현재 Initial Seat Count는 100이어서 대부분의 요청이 매진 이후 Redis-only `sold_out`으로 빠르게 종료됐다. 이 workload에서는 Redis Lua의 p95가 낮게 나온다. 하지만 좌석 수가 1,000개 또는 10,000개로 커지면 더 많은 요청이 Redis를 통과해 DB Atomic Conditional Update와 Reservation insert까지 도달한다. 이 경우 Redis Lua의 이점이 줄고 p95/p99가 DB 경합과 connection pool 10의 영향을 더 크게 받을 수 있으므로, seat count 100, 1,000, 10,000 조건을 분리해 측정해야 한다.

넷째, Redis Lua 보상 경로를 부하 상황에서 의도적으로 검증해야 한다. 현재 보상은 단위 테스트로 검증됐고 정상 k6 측정에서는 `redis_db_sync_failed`가 0이었다. 운영 전략으로 평가하려면 DB lock timeout, statement timeout, connection timeout, 강제 insert 실패를 만들어 Redis 보상이 발생하는 부하 테스트를 별도로 수행해야 한다. 이때 Redis Remaining Seats와 DB consistency가 최종적으로 복구되는지, compensation counter가 정확히 증가하는지 확인해야 한다.

다섯째, Redisson Lock은 lock 정책을 분리 측정해야 한다. 현재는 `getLock(...)`, lock wait 200ms, lease 3000ms 기준이다. 이 설정은 긴 tail을 줄이는 대신 `lock_acquire_failed`를 많이 만든다. 다음에는 wait 0ms, 200ms, 1000ms, fair lock, retry policy를 분리해 측정하고, `lock_acquire_failed`를 "매진"이 아니라 "좌석 상태 미확인/재시도 가능" 응답으로 다루는 UX와 API contract를 정해야 한다.

여섯째, 단일 Concert 고경합만이 아니라 여러 Concert 분포를 추가해야 한다. 현재 모든 요청이 Concert 1에 몰려 단일 row 경합을 극대화한다. 실제 트래픽에서는 hot concert 하나와 여러 normal concert가 섞일 수 있다. Redis Lua와 Redisson Lock이 hot-key 상황에서는 어떤 결과를 내고, 분산된 Concert ID에서는 어떤 결과를 내는지 별도 workload로 비교해야 한다.

일곱째, 측정 run을 시간 구간별로 분해해야 한다. Redis Lua의 전체 p95는 대부분의 sold-out 요청 때문에 낮게 보이지만, 실제 예약 성공 경로의 latency는 초반 100개 요청에 집중된다. 다음 보고서에서는 전체 run 지표와 함께 "좌석 소진 전 성공 경로 window", "좌석 소진 후 sold-out window"를 분리해 저장해야 한다.

## Next Phase Input

Phase 6에서는 counted-seat invariant가 보호된 상태를 전제로, 중복 요청과 idempotency를 검증해야 한다.

특히 같은 User가 같은 Concert에 여러 번 요청하는 경우를 분리해서 다뤄야 한다. Phase 5까지는 “총 좌석 수를 초과하지 않는가”를 중심으로 검증했다. Phase 6에서는 “같은 User가 중복 Reservation을 만들지 않는가”, “재시도 요청이 같은 결과로 수렴하는가”, “결제나 외부 API와 연결될 때 idempotency key를 어떻게 관리할 것인가”를 검증해야 한다.
