# 동시성 제어 부하 테스트 및 모니터링 구축 가이드 (K6 + Prometheus + Grafana)

## 본 문서는 동시성 환경에서 애플리케이션의 락(Lock) 구현 방식(락 없음, 비관적 락, 낙관적 락)에 따른 성능과 정합성 차이를 검증하기 위해 구성한 로드 테스트(Load Test) 아키텍처와 구현 세부 사항을 정리합니다.

## 1. 개요 및 테스트 전략

단순히 많은 트래픽을 보내는 것을 넘어, 환경 간(락 방식)의 상태 오염을 방지하고 에러 상황을 명확하게 분리하여 시각화하는 것이 이번 부하 테스트 설정의 핵심입니다.

### 1-1. 데이터 (DB) 격리 전략

동시성 테스트 시 하나의 상품(Concert)을 두고 3번의 테스트를 연달아 진행하면 "이미 재고가 소진"되어 뒤의 테스트가 성립하지 않는 문제가 있습니다.
이를 해결하기 위해 `02_schema.sql` 초기화 스크립트를 통해 락 테스트 전용 티켓(재고 10,000개) 3개를 미리 생성해두고, 각 방식의 테스트가 격리된 자원(Concert ID)을 소비하도록 설정했습니다.

- **Concert ID `2`: 락 없음 (No Lock? → 사실은 '재시도 없는 낙관적 락')**
  - 자바 단의 `@Version` 어노테이션에 의해 **자동 낙관적 락**이 작동함.
  - 충돌 시 재시도 정책이 없으므로, 대량의 500(Internal Server Error)이 발생하지만 정합성은 지켜지는 독특한 지표를 보임.
- **Concert ID `3`: 비관적 락 (Pessimistic Lock)**
- **Concert ID `4`: 낙관적 락 (Optimistic Lock) + 재시도 정책 포함**

#### 문제점

Phase 2의 원래 목적인 **"락 없을 때 overselling이 발생한다"는 것을 재현하려면 `@Version`을 제거해야** 합니다. 지금 상태로 k6 부하테스트를 돌리면 overselling 대신 500 에러가 터지는 결과가 나와서, "락 없는 케이스"의 문제점을 제대로 시각화하기 어렵습니다.

### 1-2. K6 지표 격리 (Tagging)

프로메테우스에 쌓인 데이터가 어떤 락 테스트의 결과인지 섞이는 것을 방지하기 위해, K6 실행 시 `test_type` 이라는 글로벌 태그(Tags)를 지정하여 메트릭을 분리(Grouping)할 수 있게 구성했습니다.

---

## 2. 장애(Error) 원인 세분화 구현

동시성 처리의 한계로 인해 발생하는 에러는 방식에 따라 양상이 다릅니다. K6에서 이 실패 원인들을 구체적으로 집계하기 위해, `ReservationController.java`에서 발생하는 `Exception`들을 상태 코드별로 분리해서 반환하도록 수정했습니다.

### 컨트롤러(`ReservationController.java`) 세분화 내용

- **정상 처리:** `200 OK`, `{"status": "reserved"}`
- **실제 재고 소진:** `409 Conflict`, `{"status": "sold_out"}`
- **낙관적 락 재시도 초과:** `409 Conflict`, `{"status": "optimistic_lock_exhausted"}`
  - 원인: 한 데이터에 요청이 몰리며 재시도 횟수(5회)를 초과하여 결국 트랜잭션을 포기한 경우
- **비관적 락 획득 타임아웃:** `408 Request Timeout`, `{"status": "lock_timeout"}`
  - 원인: 레코드 잠금을 위해 대기하던 중 Lock Timeout 이 지나 예외(`PessimisticLockingFailureException`, `QueryTimeoutException`)가 발생한 경우
- **시스템/서버 에러:** `500 Server Error`

---

## 3. K6 부하 테스트 스크립트 작성 (`load-test.js`)

각각의 락 방식을 개별적으로 테스트하되, 단일 스크립트로 동작할 수 있도록 `LOCK_TYPE` 환경변수를 설계했습니다.

### 3-1. K6 Custom Metrics (커스텀 지표 수집)

컨트롤러가 분리해 준 HTTP State와 Response Body를 분석하여 구체적으로 어떤 원인으로 테스트가 통과/실패했는지 K6의 `Counter`를 이용하여 프로메테우스로 전송합니다.

- `reservation_success_count`
- `reservation_sold_out_count`
- `reservation_optimistic_exhausted_count`
- `reservation_pessimistic_timeout_count`
- `reservation_server_error_count`
- `reservation_network_timeout_count`

### 3-2. 올바른 `check()` 활용

K6의 `check()` 구문에 응답 상태 분기를 여러 개 두게 되면, 200 성공 응답이 왔을 때 409나 408은 `FAIL`로 처리되어 전체 Check Pass Rate 통계가 왜곡되는 오해를 유발할 수 있습니다.
따라서 `check()`는 **"시스템이 의도된 비즈니스 응답 영역 내에 있는가?" (`status !== 0 && status < 500`)** 하나만을 단일 조건으로 평가하여 오탐(False Fail)을 방지했습니다.

---

## 4. 테스트 실행 방법

터미널에서 개별 환경 변수를 주입하여 각 락 방식의 부하 테스트를 순차적으로 실행합니다. (K6 컨테이너 기반)

```bash
# 1. 락 없음 (베이스라인) 테스트
docker compose --profile test run --rm -e LOCK_TYPE=none k6 run -o experimental-prometheus-rw /scripts/load-test.js

# 2. 비관적 락 (Pessimistic) 테스트
docker compose --profile test run --rm -e LOCK_TYPE=pessimistic k6 run -o experimental-prometheus-rw /scripts/load-test.js

# 3. 낙관적 락 (Optimistic) 테스트
docker compose --profile test run --rm -e LOCK_TYPE=optimistic k6 run -o experimental-prometheus-rw /scripts/load-test.js

```

### 참고

Git Bash는 명령창에 /로 시작하는 경로(예: /scripts)를 입력하면, 자기가 설치된 윈도우 경로인 C:/Program Files/Git/scripts라는 가짜 주소로 가로채서 바꿔버린 뒤 도커에게 전달합니다.

도커 컨테이너 안에는 당연히 윈도우의 C:/Program Files/Git/... 같은 폴더가 없으니 에러가 나는 것입니다.

```bash
docker compose --profile test run --rm k6 run \
  --out experimental-prometheus-rw //scripts/load-test.js
```

---

## 5. Grafana 시각화 (PromQL 쿼리 가이드)

| 공식 그라파나 K6 지원 대시보드 ID : 19665
테스트 실행 중, 혹은 종료 후 `localhost:3000`의 Grafana에서 커스텀 패널을 생성하여 다음과 같은 PromQL을 통해 3가지 락 방식의 결과를 한눈에 겹쳐서 비교할 수 있습니다.

### 📊 패널 1: 진짜 "비즈니스 성공 처리량"

가장 먼저 확인해야 할 핵심 그래프로, 주어진 시간 안에 실제로 예약을 완료시킨 처리량을 나타냅니다.

- **Query:** `rate(k6_reservation_success_count_total[1m])`
- **비교 핵심:** 세 가지 `test_type` (none, pessimistic, optimistic) 선의 높낮이를 통해 어떤 방식이 트래픽을 효율적으로 수용했는지 비교할 수 있습니다. (단, **none 방식**은 재시도 로직이 없어 실패율이 매우 높게 나타납니다.)

### 📊 패널 2: "에러의 질(Quality)" 추적 - 병목 지점 증명

우리가 의도적으로 분리해둔 예외들이 어떤 부하 패턴에서 터지는지 비교합니다. 아래 쿼리들을 활용해 시각화합니다.

- **낙관적 락의 치명타 (재시도율 폭발):** `rate(k6_reservation_optimistic_exhausted_count_total[1m])`
  - 그래프 확인 포인트: 어느 정도의 부하가 가해졌을 때 이 수치가 기하급수적으로 치솟는지 (낙관적 락의 한계점 돌파) 확인할 수 있습니다.
- **비관적 락의 치명타 (DB 락 대기 타임아웃):** `rate(k6_reservation_pessimistic_timeout_count_total[1m])`
  - 그래프 확인 포인트: 응답시간이 늘어나다가 이 수가 꾸준하게 발생하는 구간을 관찰할 수 있습니다.

### 📊 패널 3: 응답 지연 (Latency - P95)

각 요청이 서버에 도달하여 응답으로 돌아오기까지 얼만큼의 지연이 발생했는지를 비교합니다.

- **Query:** `k6_http_req_duration_seconds{quantile="0.95"}`
- **비교 핵심:** 비관적 락(`pessimistic`) 방식의 선이 가파르게 치솟아 있는(매우 느린) 양상을 명확하게 파악할 수 있습니다.

> 위 3가지 패널(성공률, 한계 원인, 레이턴시)의 시각화 결과를 리포트에 첨부하여 트레이드오프(Trade-Off) 의사결정을 증명하는 데 활용할 수 있습니다.

---

## 📌 테스트 핵심 발견 (Key Findings)

### ❓ "락 없음(None)" 테스트에서 왜 500 에러가 대량 발생했는가?

1. **상황:** `LOCK_TYPE=none` 테스트 시, 성공 응답은 적고 대량의 `reservation_server_error_count(500)`가 발생함.
2. **원인:** 엔티티의 **`@Version` 어노테이션** 때문.
   - 락을 명시적으로 걸지 않아도 JPA가 자동으로 버전 체크를 수행함.
   - 동시 수정 충돌 시 `ObjectOptimisticLockingFailureException`이 발생함.
   - **`none` 방식**은 이 에러를 캐치해서 재시도하지 않으므로 곧바로 사용자에게 500 에러를 반환함. (결과적으로 정합성은 유지됨)

### ❓ "낙관적 락(Optimistic)"과 "None"의 결정적 차이

- **None:** 버전 충돌 시 **즉시 실패(Fail-fast)**. 에러율은 매우 높으나, 시스템 정합성은 `@Version` 덕분에 유지됨.
- **Optimistic:** 버전 충돌 시 **내부적으로 재시도(Retry)**. 에러율은 낮아지지만, 재시도 횟수만큼 CPU 부하와 응답 시간(Latency)이 늘어남.

### ❓ "비관적 락(Pessimistic)"의 압도적 안정성

- 비관적 락은 충돌 시 에러를 내지 않고 **줄을 세워 대기(Blocking)** 시킴.
- 대기 시간이 길어질 순 있으나(Latency 증가), 줄만 잘 서면 **실패 없이 모든 요청이 성공(Success 100%)**하는 안정성을 보여줌.
- 단일 자원 경합이 심한(Hotspot) 티켓팅 아키텍처에서는 **비관적 락**이 가장 정석적인 해결책임을 데이터를 통해 증명함.

---

## 변경해볼 만한 하이퍼파라미터

### 1. K6 부하 패턴 (load-test.js)

**현재값:** 50 VU, ramp 10s → 유지 30s → 감소 5s

#### VU 수와 단계

현재 50 VU는 재고 10,000개에 비해 경합이 약합니다. 락의 한계를 더 명확하게 드러내려면:

```
stages: [
  { duration: "10s", target: 100 },
  { duration: "30s", target: 200 },  // 경합 강도 증가
  { duration: "10s", target: 500 },  // 순간 spike
  { duration: "5s",  target: 0 },
]
```

- **비관적 락**은 VU가 늘수록 `lock_timeout`이 급격히 늘어나는 "tipping point"가 시각화됨
- **낙관적 락**은 `optimistic_exhausted`가 폭발하는 구간이 뚜렷해짐

---

### 2. 낙관적 락 재시도 설정 (ReservationService.java)

**현재값:** maxRetries=4 (총 5회), delay=100ms

| 파라미터     | 현재  | 변경 실험   | 효과                                                |
| ------------ | ----- | ----------- | --------------------------------------------------- |
| `maxRetries` | 4     | 1, 9        | 재시도 횟수가 `exhausted`율과 latency에 미치는 영향 |
| `delay`      | 100ms | 10ms, 500ms | jitter 없는 고정 delay → thundering herd 문제 재현  |

delay=10ms면 재시도가 몰려서 오히려 충돌률이 더 높아지는 역설적 결과가 나올 수 있습니다 — 이게 "thundering herd" 현상이고, 이를 설명하는 자료로 쓸 수 있습니다.

---

### 3. HikariCP 커넥션 풀 (application.yml)

**현재값:** maximum-pool-size=30

비관적 락에서 VU가 많을 때 커넥션이 고갈되어 `server_error`가 발생할 수 있습니다. 이게 `lock_timeout`인지 커넥션 고갈인지 구분이 안 됩니다.

```yaml
hikari:
  maximum-pool-size: 10 # 극단적으로 줄이면 커넥션 병목 재현
  connection-timeout: 3000 # 기본 30s → 3s로 줄여서 빠른 실패
```

또는 반대로 100으로 늘려서 "커넥션이 충분할 때 순수하게 락 성능만" 비교하는 실험도 가능합니다.

---

## 추가로 진행해보면 좋을 실험

### A. Exponential Backoff + Jitter (낙관적 락 재시도 개선)

현재 fixed delay 100ms 방식은 재시도가 동시에 몰리는 문제가 있습니다. `delay * (1 + random())` 방식(jitter)으로 바꾸면 `exhausted`율이 눈에 띄게 떨어지는지 그라파나로 직접 확인할 수 있습니다. — "왜 재시도에 jitter가 필요한가"를 데이터로 증명하는 실험입니다.

### B. 재고 수량 변경 실험

현재 재고 10,000개는 50 VU 기준으로 거의 소진되지 않습니다. 재고를 **100개**로 줄이면:

- 실제 `sold_out`이 발생하는 시점을 볼 수 있음
- 재고 소진 전후로 에러 패턴이 달라지는지 관찰 가능

### C. `constant-arrival-rate` executor 실험 => Skip

현재 `ramping-vus`는 VU 수를 기준으로 부하를 조절합니다. `constant-arrival-rate`는 **초당 요청 수(RPS)**를 고정하기 때문에, 비관적 락의 응답이 느려져도 RPS를 유지하면서 큐가 쌓이는 현상을 더 현실적으로 재현할 수 있습니다.

```js
scenarios: {
  constant_load: {
    executor: "constant-arrival-rate",
    rate: 300,         // 초당 300 RPS
    timeUnit: "1s",
    duration: "30s",
    preAllocatedVUs: 100,
  }
}
```

### D. PostgreSQL Lock Timeout 튜닝

현재 DB 레벨의 `lock_timeout`이 명시적으로 설정되어 있지 않습니다. `SET lock_timeout = '1s'`를 트랜잭션 시작 시 실행하거나 application.yml에서 설정하면 비관적 락 타임아웃을 더 정밀하게 제어할 수 있고, `lock_timeout`을 짧게/길게 바꾸는 것 자체가 하나의 실험 축이 됩니다.

#### 커넥션 풀 대기 시간 (Connection Timeout)

사용자 표현: "요청했고 커넥션 풀을 받기까지 대기하는 시간"
설명: DB에 쿼리를 보내기 전, 빈 커넥션을 'HikariCP'(스프링 기본) 같은 풀에서 빌려오려고 줄을 서는 시간입니다. 이 시간이 지나면 ConnectionTimeoutException이 발생합니다.

```yaml
spring:
  datasource:
    hikari:
      connection-timeout: 3000 # 3초 동안 커넥션을 못 받으면 에러 발생(기본30초)
      maximum-pool-size: 10 # 비교를 위해 풀 사이즈도 같이 조절하곤 함(기본 10개)
```

#### 비관적 락 대기 시간 (Lock Timeout)

사용자 표현: "커넥션 풀을 받고 (소유권을 위해) 얼마나 대기하나"
설명: 커넥션을 일단 빌려왔습니다. 그리고 SELECT ... FOR UPDATE 쿼리를 던졌는데, 다른 사람이 이미 락을 잡고 있어서 DB 안에서 기다리는 시간입니다. 이 시간이 지나면 LockTimeoutException이 발생합니다.
=>>> 근데 이렇게 설정해도 안되는거 같은데 gemini 피셜로는 "하지만 PostgreSQL은: SELECT ... FOR UPDATE 쿼리 자체에 "N초만 기다려라"라는 문법이 없습니다. 오직 NOWAIT(0초) 아니면 SKIP LOCKED만 지원
Hibernate의 반응: PostgreSQL Dialect는 이 힌트를 받아도 그냥 무시하고 일반적인 SELECT ... FOR UPDATE를 날려버립니다. 그래서 설정한 1초가 적용되지 않고 DB가 허용하는 한(혹은 HikariCP가 허용하는 한) 무한정 기다리게 된 것

```
spring:
  datasource:
    hikari:
      connection-init-sql: "SET lock_timeout = '1s'"

```

"

```yaml
spring:
  jpa:
    properties:
      javax.persistence.lock.timeout: 1000 # 1초 (단위: ms) (postgresql 기준 무한대기 )
```

---

### 요약 우선순위

| 우선순위 | 항목                           | 기대 효과                       |
| -------- | ------------------------------ | ------------------------------- |
| ★★★      | VU 200~500으로 증가            | 락 방식별 tipping point 시각화  |
| ★★★      | 재고를 100~500개로 축소        | sold_out 도달 및 에러 전환 관찰 |
| ★★☆      | 낙관적 delay 10ms로 감소       | thundering herd 현상 재현       |
| ★★☆      | constant-arrival-rate executor | 현실적 RPS 기반 비교            |
| ★☆☆      | HikariCP pool-size 조정        | 커넥션 병목 vs 락 병목 분리     |
