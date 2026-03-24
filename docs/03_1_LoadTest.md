# 동시성 제어 부하 테스트 및 모니터링 구축 가이드 (K6 + Prometheus + Grafana)

본 문서는 동시성 환경에서 애플리케이션의 락(Lock) 구현 방식(락 없음, 비관적 락, 낙관적 락)에 따른 성능과 정합성 차이를 검증하기 위해 구성한 로드 테스트(Load Test) 아키텍처와 구현 세부 사항을 정리합니다.

---

## 1. 개요 및 테스트 전략

단순히 많은 트래픽을 보내는 것을 넘어, 환경 간(락 방식)의 상태 오염을 방지하고 에러 상황을 명확하게 분리하여 시각화하는 것이 이번 부하 테스트 설정의 핵심입니다.

### 1-1. 데이터 (DB) 격리 전략

동시성 테스트 시 하나의 상품(Concert)을 두고 3번의 테스트를 연달아 진행하면 "이미 재고가 소진"되어 뒤의 테스트가 성립하지 않는 문제가 있습니다.
이를 해결하기 위해 `02_schema.sql` 초기화 스크립트를 통해 락 테스트 전용 티켓(재고 10,000개) 3개를 미리 생성해두고, 각 방식의 테스트가 격리된 자원(Concert ID)을 소비하도록 설정했습니다.

- Concert ID `2`: 락 없음 (No Lock) 용
- Concert ID `3`: 비관적 락 (Pessimistic) 용
- Concert ID `4`: 낙관적 락 (Optimistic) 용

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
docker-compose run --rm -e LOCK_TYPE=none -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write k6 run -o experimental-prometheus-rw /scripts/load-test.js

# 2. 비관적 락 (Pessimistic) 테스트
docker-compose run --rm -e LOCK_TYPE=pessimistic -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write k6 run -o experimental-prometheus-rw /scripts/load-test.js

# 3. 낙관적 락 (Optimistic) 테스트
docker-compose run --rm -e LOCK_TYPE=optimistic -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write k6 run -o experimental-prometheus-rw /scripts/load-test.js
```

---

## 5. Grafana 시각화 (PromQL 쿼리 가이드)

테스트 실행 중, 혹은 종료 후 `localhost:3000`의 Grafana에서 커스텀 패널을 생성하여 다음과 같은 PromQL을 통해 3가지 락 방식의 결과를 한눈에 겹쳐서 비교할 수 있습니다.

### 📊 패널 1: 진짜 "비즈니스 성공 처리량"

가장 먼저 확인해야 할 핵심 그래프로, 주어진 시간 안에 실제로 예약을 완료시킨 처리량을 나타냅니다.

- **Query:** `rate(k6_reservation_success_count_total[1m])`
- **비교 핵심:** 세 가지 `test_type` (none, pessimistic, optimistic) 선의 높낮이를 통해 어떤 방식이 트래픽을 효율적으로 수용했는지 비교할 수 있습니다. (단, none 방식은 'Lost Update'로 인해 성공 처리량만 높고 실제 재고는 망가졌을 가능성이 높습니다)

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
