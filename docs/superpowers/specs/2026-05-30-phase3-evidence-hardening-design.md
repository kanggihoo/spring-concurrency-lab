# Phase 3 Evidence Hardening Design

## 배경

Phase 3의 목적은 PostgreSQL 기반 Remaining Seats 차감 전략 세 가지를 같은 baseline 조건에서 비교하고, 각 전략이 counted-seat invariant를 지키는지 확인하는 것이다.

대상 전략은 다음 세 가지다.

- Pessimistic Lock
- Optimistic Lock + Retry
- Atomic Conditional Update

기존 Phase 3 구현과 기본 evidence는 존재하지만, 포트폴리오 문서로 사용하기에는 증거 추적성이 부족했다. 특히 k6 summary, terminal log, Grafana run-window가 같은 실행 단위를 명확히 가리키지 않았고, `Retry Count`, `p99`, `pg_locks_count` 같은 보고서 수치의 raw evidence가 부족했다.

이번 hardening의 목표는 결론을 미리 정하는 것이 아니다. 새 측정 체계를 만들고, 같은 조건에서 세 전략을 다시 한 번씩 실행한 뒤, 실제로 수집된 evidence만 근거로 `report.md`를 갱신한다.

## 원칙

- 결과를 미리 정하지 않는다.
- `report.md`의 결론은 새로 수집한 evidence를 본 뒤 작성한다.
- Phase 3는 전략 비교 phase이며, connection pool 한계나 lock timeout 정책 실험은 Phase 4 범위로 둔다.
- Phase 3 baseline의 expected HTTP status는 `200`, `409`만 둔다.
- `409`는 HTTP status만으로 해석하지 않고 response body의 `status` 값으로 분류한다.
- `408 lock_timeout`은 Phase 3 baseline의 expected result가 아니다. 관측되면 unexpected response 또는 별도 이상 징후로 기록한다.
- `pg_locks_count`는 lock wait가 아니라 lock activity signal로만 표현한다.
- Grafana screenshot은 시각 증거이며, 표에 들어가는 숫자의 source of truth는 k6 summary, SQL snapshot, Prometheus raw query result로 둔다.

## 현재 문제

### Evidence 실행 단위 불일치

기존 evidence는 k6 summary와 terminal log가 같은 timestamp의 실행을 가리키지 않았다. 이 상태에서는 `report.md`의 RPS, p95, p99 수치를 방어하기 어렵다.

대응:

- 기존 Phase 3 evidence는 `docs/evidence/03-db-strategies/archive/20260527-original/` 아래로 분리한다.
- 새 측정 결과만 `docs/evidence/03-db-strategies/<strategy>/` 아래에 둔다.
- 새 `report.md`는 archive evidence를 참조하지 않는다.

### p99 source 불일치

기존 report는 p95는 k6 summary에서, p99는 Prometheus/Grafana에서 가져왔다. source가 섞이면 수치 해석이 약해진다.

대응:

- `k6/run.sh`는 이미 `--summary-export`로 summary JSON을 저장한다. Phase 3 공식 실행 경로는 `bash k6/run.sh ...`이므로 추가 CLI 옵션은 필요 없다.
- `k6/reservation-test.js`에 `summaryTrendStats`를 추가해 k6 summary JSON에 `p(99)`가 포함되게 한다.
- `k6/run.sh`를 우회해 k6를 직접 실행할 경우에는 `--summary-export <파일>`을 반드시 붙인다.
- 새 report의 RPS, p95, p99, iterations, HTTP failure rate는 k6 summary JSON에서 읽는다.

### 409 응답 분류 부재

현재 k6는 `200` 또는 `409` 여부만 확인한다. 이 방식은 `409 sold_out`과 `409 optimistic_lock_exhausted`를 구분하지 못한다.

대응:

- k6가 response body의 `status` 값을 읽어 custom counter를 증가시킨다.
- Phase 3에서 필요한 counter는 다음과 같다.

```text
reservation_reserved
reservation_sold_out
reservation_optimistic_lock_exhausted
reservation_unexpected_status
```

분류 규칙:

```text
200 + status=reserved -> reservation_reserved
409 + status=sold_out -> reservation_sold_out
409 + status=optimistic_lock_exhausted -> reservation_optimistic_lock_exhausted
그 외 status/body -> reservation_unexpected_status
```

`reservation_lock_timeout`은 Phase 3 핵심 counter로 두지 않는다. 현재 Phase 3 baseline에는 lock timeout 설정이 없으므로 `408 lock_timeout`을 expected result로 취급하지 않는다.

### Retry Count raw evidence 부재

Optimistic Lock retry count는 애플리케이션 Micrometer counter에서 나온다. 보고서에 숫자를 적으려면 Prometheus raw query 결과를 저장해야 한다.

대응:

- Prometheus API로 optimistic retry metric을 조회하고 JSON/text evidence로 저장한다.
- 실제 metric 이름은 실행 전 `/actuator/prometheus` 또는 Prometheus query로 확인한다. 예상 이름은 `reservation_optimistic_retry_total`이다.
- report에는 k6의 `reservation_optimistic_lock_exhausted`와 앱 metric의 retry attempt count를 구분해서 쓴다.

### Lock wait 표현 부정확

`pg_locks_count max 9`는 lock wait가 아니라 PostgreSQL lock activity 신호다. lock wait를 주장하려면 `pg_stat_activity.wait_event`, blocking PID, granted=false lock 같은 추가 evidence가 필요하다.

대응:

- Prometheus raw query로 `pg_locks_count` run-window 결과를 저장한다.
- Pessimistic run 중 별도 터미널에서 `pg_stat_activity`와 `pg_locks` snapshot 저장을 1회 이상 시도한다.
- 실행 중 snapshot을 못 잡았거나 wait snapshot에 row가 없으면 lock wait를 관측했다고 쓰지 않는다.
- report에는 `Lock Activity`와 `Lock Wait Snapshot`을 구분한다.

## API 응답 계약

현재 Java controller의 Phase 3 응답 계약은 유지한다.

### Pessimistic Lock

- `200 {"status":"reserved"}`
- `409 {"status":"sold_out"}`
- `408 {"status":"lock_timeout"}`는 코드 분기만 존재한다. Phase 3 baseline에는 timeout 설정이 없으므로 expected result가 아니다.

### Optimistic Lock + Retry

- `200 {"status":"reserved"}`
- `409 {"status":"sold_out"}`
- `409 {"status":"optimistic_lock_exhausted"}`

`OptimisticLockRetryExhaustedException`은 timeout이 아니라 concurrency conflict의 retry budget 초과다. 따라서 `408`이 아니라 `409`로 유지한다.

### Atomic Conditional Update

- `200 {"status":"reserved"}`
- `409 {"status":"sold_out"}`

## k6 변경 설계

`k6/reservation-test.js`를 다음 방향으로 바꾼다.

1. `Counter`를 import한다.
2. `summaryTrendStats`에 `p(99)`를 추가한다.
3. expected status는 preset에서 읽되, 기본값은 `[200, 409]`로 둔다.
4. Phase 3 preset에는 명시적으로 `"expectedStatuses": [200, 409]`를 둔다.
5. response body의 `status` 값을 읽어 counter를 분류한다.
6. body parse 실패, status/body mismatch, 500 등은 `reservation_unexpected_status`로 기록한다.

기본 expected status:

```javascript
const expectedStatuses = preset.expectedStatuses || [200, 409];
const reservationResponseCallback = http.expectedStatuses(...expectedStatuses);
```

필수 trend stats:

```javascript
summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]
```

summary 파일 저장은 `k6/run.sh`의 `--summary-export`가 담당한다. 구현 계획은 이 옵션이 빠지지 않았는지 검증하되, Phase 3 공식 실행 명령에 별도 k6 CLI 옵션을 추가하지 않는다.

## Evidence 수집 대상

각 전략 실행 후 다음 파일을 남긴다.

```text
docs/evidence/03-db-strategies/<strategy>/
├── k6/
│   └── *-summary.json
├── logs/
│   └── *.log
├── sql/
│   ├── baseline-consistency.txt
│   ├── pg-stat-activity.txt          # pessimistic 실행 중 snapshot 시도 결과
│   └── pg-lock-summary.txt           # pessimistic 실행 중 snapshot 시도 결과
├── prometheus/
│   ├── k6-window-summary.json
│   ├── optimistic-retry-total.json    # optimistic strategy
│   └── pg-locks-count.json            # pessimistic strategy
└── grafana/
    ├── run-window-*.json
    └── stitched-dashboard.png
```

공통 evidence:

- k6 summary JSON
- k6 terminal log
- Grafana run-window JSON
- SQL consistency snapshot
- run metadata

전략별 추가 evidence:

- Optimistic: optimistic retry total Prometheus query result
- Pessimistic: `pg_locks_count` Prometheus query result, 실행 중 `pg_stat_activity`와 `pg_locks` snapshot 시도 결과
- Atomic: 별도 retry/lock evidence 없음. k6 response counter와 SQL consistency로 판단

## 실행 순서

세 전략은 순차 실행한다. 각 전략은 하나의 실행 단위로 수집한다.

1. 애플리케이션과 observability stack을 실행한다.
2. Phase 3 관련 테스트를 실행하고 로그를 저장한다.
3. Pessimistic baseline을 실행한다.
4. 같은 실행 단위의 k6 summary, terminal log, run-window, SQL consistency, Prometheus query result를 저장한다.
5. Optimistic baseline을 실행하고 같은 방식으로 저장한다.
6. Atomic baseline을 실행하고 같은 방식으로 저장한다.
7. 수집된 evidence를 파싱해 report table 값을 만든다.
8. `report.md`, `README.md`, `scope.md`, `observability.md`, `runbook.md`를 evidence 기준으로 갱신한다.

## Report 갱신 규칙

`report.md`는 evidence 수집 후 갱신한다. 작성 순서는 다음과 같다.

1. Experimental Setup
2. Metric Definitions
3. Evidence Source
4. Results
5. Findings
6. Limitations
7. Decision
8. Next Phase Input

결과 표에는 최소한 다음 항목을 포함한다.

- Strategy
- RPS
- p95
- p99
- HTTP failure rate
- Reserved
- Sold Out
- Optimistic Lock Exhausted
- Unexpected Responses
- Optimistic Retry Attempts
- Seat Count Inconsistency
- Overbooking
- Lock Activity
- Evidence

`Decision` 섹션은 측정 결과를 본 뒤 작성한다. 특정 전략을 사전에 default로 확정하지 않는다.

## 완료 기준

- 기존 Phase 3 report가 archive evidence를 참조하지 않는다.
- 새 k6 summary JSON에 `p(99)`와 response classification counter가 포함된다.
- 세 전략 모두 새 k6 summary, terminal log, SQL consistency snapshot을 가진다.
- Optimistic retry count는 Prometheus raw query evidence로 남는다.
- Pessimistic lock activity는 Prometheus raw query evidence로 남고, lock wait 여부는 snapshot evidence 유무에 맞게 표현된다.
- `reservation_unexpected_status`가 0이면 정상 baseline으로 해석한다.
- 예상 밖 500 또는 408이 발생하면 정상 결과로 숨기지 않고 report의 이상 징후로 기록한다.
- README status와 scope completion gate가 실제 상태와 일치한다.

## 범위 밖

- Phase 3에서 pool size matrix를 수행하지 않는다.
- Phase 3에서 lock timeout 정책을 검증하지 않는다.
- Phase 3에서 connection pool exhausted 응답 계약을 새로 정의하지 않는다.
- Phase 3에서 Redis, idempotency, WireMock 외부 API 지연을 다루지 않는다.
- Phase 3에서 EXPLAIN ANALYZE 기반 query plan tuning을 추가하지 않는다.

## 후속 계획 입력

이 spec의 다음 단계는 implementation plan 작성이다. plan은 먼저 k6 summary/counter와 evidence exporter를 보강하고, 그 다음 새 Phase 3 baseline evidence를 수집한 뒤, 마지막으로 report와 phase docs를 갱신해야 한다.
