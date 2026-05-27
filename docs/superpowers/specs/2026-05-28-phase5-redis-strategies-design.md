# Phase 5 Redis Concurrency Strategies 설계

## 목적

Phase 5의 목적은 Redis 전략이 항상 더 빠르다는 가정을 검증하는 것이 아니라, 현재 counted-seat 모델에서 Redis를 도입할 운영상 이유가 있는지 판단하는 것이다. 비교 기준은 Phase 4에서 확정한 DB Atomic Conditional Update이며, pool 10은 보수적 운영 기준, pool 50은 로컬 측정상 DB 처리량 상한 기준으로 사용한다.

이번 Phase의 성공 기준은 Redis가 DB보다 빠른지 여부만이 아니다. Redisson Lock과 Redis Lua Atomic Decrement가 정합성, RPS, p95/p99, Redis 관측 지표, 보상 처리 복잡도, DB 부하 감소 여부를 종합했을 때 기본 전략으로 둘 만한지 판단할 수 있어야 한다.

## 범위

구현 및 측정 대상은 세 가지다.

- Redisson Lock
- Redis Lua Atomic Decrement
- DB Atomic Conditional Update baseline 비교

Redis Cluster, Redlock 심화 논쟁, 비동기 DB 동기화, pending Reservation, seat hold, reconciliation worker, Kafka/Outbox, 결제 상태머신은 이번 Phase 범위에서 제외한다. 이 항목들은 Redis를 eventual consistency 예약 모델로 확장할 때 필요한 주제이며, 현재 Phase의 동시성 전략 비교와 분리한다.

## 기준 모델

도메인 기준은 기존 `CONTEXT.md`를 따른다.

- Concert는 Initial Seat Count와 Remaining Seats를 가진다.
- Reservation은 성공적으로 확정된 예약 기록이다.
- 성공 응답은 DB Reservation 저장까지 성공한 뒤에만 반환한다.
- 모든 전략은 `reservation_count + remaining_seats == initial_seat_count`를 만족해야 한다.
- Phase 5 정상 부하 실험의 기대 최종 상태는 Reservation 100건, Remaining Seats 0, Seat Count Inconsistency 0, Overbooking false다.

## Redisson Lock 설계

Redisson Lock 전략에서 Redis는 좌석 수 저장소가 아니라 lock coordinator로만 사용한다. 좌석 차감과 Reservation 저장의 기준 저장소는 DB다.

흐름은 다음과 같다.

1. Concert 단위 lock key를 만든다.
2. Redisson `tryLock`으로 짧은 시간만 lock 획득을 시도한다.
3. lock 획득 성공 시 DB 트랜잭션 안에서 Remaining Seats를 차감하고 Reservation을 저장한다.
4. lock 획득 실패 시 `lock_acquire_failed` 응답을 반환하고 metric을 증가시킨다.
5. 작업 종료 시 lock을 해제한다.

`tryLock`은 긴 대기보다 빠른 실패를 우선한다. 이 정책은 Phase 4의 lock wait/timeout 관측과 비교하기 쉽고, Redis lock이 단순 counted-seat row 차감에서 추가 비용을 정당화하는지 보기 좋다. lease time은 애플리케이션이 비정상 종료되어도 lock이 영구 점유되지 않도록 설정한다.

## Redis Lua Atomic Decrement 설계

Redis Lua 전략에서 Redis는 빠른 차감 gate 역할을 한다. DB는 계속 Reservation과 counted-seat invariant의 기준 저장소다.

흐름은 다음과 같다.

1. Redis에 Concert별 Remaining Seats 값을 초기화한다.
2. Redis Lua script로 Remaining Seats가 0보다 큰지 확인하고, 가능하면 Redis 값을 원자적으로 차감한다.
3. Redis 차감 실패 시 sold-out 응답을 반환한다.
4. Redis 차감 성공 시 같은 요청 흐름에서 DB `remaining_seats`를 차감하고 Reservation을 저장한다.
5. DB 처리까지 성공한 뒤에만 reserved 응답을 반환한다.
6. Redis 차감 성공 후 DB 처리 실패가 발생하면 Redis Remaining Seats를 `INCR`로 보상 복구하고 compensation metric을 증가시킨다.

이 설계는 Redis만 차감하고 DB 저장을 비동기로 지연 처리하는 eventual consistency 모델을 사용하지 않는다. 그 방식은 성공 응답과 DB Reservation 생성 시점이 분리되어 `Reservation`의 의미가 바뀌므로 Phase 5 범위에서 제외한다.

## 오류 처리

Redisson Lock의 주요 오류는 lock 획득 실패다. 이 경우 DB 트랜잭션을 시작하지 않고 `lock_acquire_failed`로 분류한다. lock 획득 후 DB 처리 중 sold-out이 발생하면 기존 sold-out 응답으로 처리한다.

Redis Lua의 주요 오류는 Redis 차감 성공 후 DB 실패다. DB 실패에는 DB 차감 실패, Reservation 저장 실패, 트랜잭션 예외가 포함된다. 이 경우 Redis 값을 보상 복구하고, 최종적으로 요청은 실패 응답으로 처리한다. 보상 실패 자체는 별도 metric과 로그로 남겨야 하며, report에서는 Redis-DB 불일치 위험으로 기록한다.

## 테스트 전략

정합성 테스트는 Redisson Lock과 Redis Lua 각각에 대해 동시 요청 후 counted-seat invariant를 검증한다. 모든 성공 Reservation 수와 DB Remaining Seats 합이 Initial Seat Count와 같아야 하며, Overbooking은 발생하지 않아야 한다.

Redis Lua 보상 테스트는 정상 k6 부하와 분리한다. 별도 테스트 코드에서 Redis 차감 성공 후 DB 처리 실패를 강제로 발생시킨다. 이 테스트는 Redis Remaining Seats가 복구되는지, DB Reservation이 생성되지 않는지, compensation metric이 증가하는지를 확인한다.

k6 성능 테스트는 정상 경로만 실행한다. 실패 주입을 k6에 섞으면 Redisson, Lua, Atomic baseline의 RPS와 p95/p99 비교가 오염되므로 제외한다.

## 측정 및 증거

Phase 5는 Phase 4와 같은 baseline k6 shape를 사용한다.

- 100 VUs
- 10 seconds
- Concert 1
- Initial Seat Count 100

저장할 evidence는 다음과 같다.

- Atomic Conditional Update pool 10, pool 50 k6 결과
- Redisson Lock k6 결과
- Redis Lua Atomic Decrement k6 결과
- 각 실행 후 DB consistency SQL
- Redis 전략 실행 후 Redis Remaining Seats snapshot
- Redis connected clients, command duration
- App metric: lock acquire fail count, compensation count
- Spring metric: Hikari active/pending

Report는 Redis가 DB보다 빠른지뿐 아니라, Redis 도입으로 추가된 운영 복잡도가 성능이나 DB 부하 감소로 정당화되는지까지 기록한다.

## 구현 단위

구현은 기존 Spring service/controller 구조를 유지하면서 Redis 전략별 entrypoint를 추가한다. k6 preset은 Redisson과 Lua 경로를 분리하고, Makefile은 Phase 5 evidence 수집을 위한 공식 실행 인터페이스로 확장한다.

필요한 기반 작업은 다음과 같다.

- Redis와 redis_exporter를 Docker Compose에 추가
- Prometheus Redis scrape target 추가
- Spring Redis/Redisson 의존성 추가
- Redis Remaining Seats 초기화와 snapshot 확인 경로 추가
- Redisson Lock service method와 API endpoint 추가
- Redis Lua service method와 API endpoint 추가
- compensation metric과 lock acquire fail metric 추가
- Phase 5 k6 preset과 evidence 디렉터리 구성 추가

## 기대 결론 형태

Phase 5의 최종 결론은 다음 질문에 답해야 한다.

- Redisson Lock은 Atomic Conditional Update보다 빠른가, 아니면 lock 왕복 비용 때문에 불리한가?
- Redis Lua는 sold-out 이후 요청을 DB 앞에서 줄이는 효과가 있는가?
- Redis Lua의 보상 처리 복잡도는 현재 counted-seat 모델에서 감수할 만한가?
- 이 프로젝트의 기본 전략은 DB Atomic Conditional Update로 유지할지, Redis 전략을 선택 후보로 올릴지?

현재 가설은 DB Atomic Conditional Update가 단순 counted-seat 모델의 기본 전략으로 가장 유리할 가능성이 높다는 것이다. Redis 전략은 성능 우위가 확인되거나, DB 부하 감소와 운영 요구가 명확할 때 선택 후보가 된다.
