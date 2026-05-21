# Spring Boot Monitoring Setup Summary

이 문서는 지금까지 진행한 Spring Boot ↔ Prometheus ↔ Grafana 연동 및 모니터링 구축 작업의 핵심 내용을 정리한 것입니다. 추후 학습 후 다시 작업을 이어나가실 때 참고하시기 바랍니다.

## 1. 현재까지 완료된 작업 (진행 상황)

### ① Spring Boot 설정 (`application.yml` 및 `build.gradle`)

- **의존성 추가**: `spring-boot-starter-actuator`, `micrometer-registry-prometheus` 의존성을 통해 Spring Boot 앱이 JVM 및 애플리케이션 메트릭을 수집하도록 설정했습니다.
- **엔드포인트 노출**: `application.yml`에서 Actuator의 `prometheus` 엔드포인트를 노출시켰습니다.
- **메트릭 태그 추가**: 메트릭을 분류하기 쉽도록 `application: concurrency` 태그를 전역으로 추가했습니다.(`application.yml` 참고)
  - 이를 통해 `http://localhost:8080/actuator/prometheus`로 접속하면 수집된 메트릭 데이터를 확인할 수 있습니다.

### ② Prometheus 설정 (`docker-compose.yml` & `prometheus.yml`)

- **Docker Compose**: Prometheus 컨테이너를 도커로 띄우고, 로컬 설정 파일(`prometheus.yml`)을 마운트하여 구동했습니다.
- **Scrape Config**: `prometheus.yml`에서 로컬 호스트의 Spring Boot 앱(포트 8080)을 `host.docker.internal:8080`을 통해 주기적(5초/10초 등)으로 긁어오도록(Scrape) 설정했습니다.
- **⚠️ 데이터 소실 주의 (데이터 휘발성)**: 현재 프로메테우스의 데이터 저장 경로(`/prometheus`)에 대한 볼륨 설정이 빠져 있습니다. 이로 인해 `docker compose down`으로 컨테이너를 삭제하면 **그동안 수집된 모든 메트릭(과거 이력) 데이터가 사라지게 됩니다.**
  - **해결책**: 나중에 데이터를 보존하고 싶다면 `docker-compose.yml`의 `prometheus` 서비스 섹션에 `prometheus-data:/prometheus`와 같은 볼륨을 추가 연동해야 합니다.

### ③ Grafana 로컬 연동 및 대시보드 불러오기

- **Grafana 실행**: Docker Compose를 통해 Grafana(포트 3000)를 구동했습니다.
- **Data Source 연동**: Grafana 내에서 Prometheus를 Data Source로 추가하고 연결 테스트를 완료했습니다.

### ④ Grafana Dashboard 환경변수(Variable) 트러블슈팅

- **문제 현상**: 대시보드를 임포트한 직후 매번 'Query Options'에서 수동으로 Refresh를 해야만 그래프가 나타나는 현상.
- **원인 및 해결 방향**:
  1. Grafana 변수(`$application`, `$instance`)가 Prometheus의 실제 메트릭 데이터와 매핑되지 않거나,
  2. 대시보드 로드 시 자동 갱신(`Refresh on dashboard load`) 설정이 안 되어 있거나,
  3. 현재 선택된 정상 상태 값을 **"대시보드 기본값(Default)"**으로 저장하지 않아서 발생합니다.
- **조치 사항**: Settings -> Variables 항목에서 각 변수의 Query를 `label_values(...)` 형태로 바로잡고, 정상 작동하는 상태에서 `Save current variable values as dashboard default`에 꼭 체크한 후 대시보드를 덮어써서 문제를 해결할 수 있습니다.

### ⑤ k6 부하 테스트 구축 및 Prometheus Remote Write 연동

- **k6 동작 구조 및 동기적 요청**: k6는 스크립트(`simple_test.js`)에 정의된 `vus`(Virtual Users) 수만큼 가상의 사용자를 생성하여, 각각 독립적으로 동시에 API 엔드포인트에 요청을 보냅니다. 한 명의 VU는 요청을 보내고 (동기적으로) 응답을 받을 때까지 기다린 후, 응답을 확인(`check`)하고 다시 다음 요청을 반복 수행하는 **동기(Synchronous) 루프** 형태를 가집니다. 이를 `duration` 시간 동안 무한히 반복하여 부하를 창출합니다.
- **Docker Compose 실행 및 종료 (`Exited (0)`)**: `docker compose --profile test up k6` 명령어로 테스트가 실행되면 k6 컨테이너가 생성됩니다. 테스트(`duration: '10s'`)가 모두 끝나면, 더 이상 실행할 프로세스가 없으므로 컨테이너 자체가 정상적으로 임무를 완수하고 **`STATUS: Exited (0)`** 상태로 자동 종료됩니다. 이는 에러(비정상 종료)가 아닌 성공적인 스크립트 실행 완료를 의미합니다!
- **Remote Write 연동 확인**: k6는 다른 앱들처럼 Prometheus가 긁어가는(Pull) 방식이 아니라, 테스트 도중 발생한 메트릭들을 직접 Prometheus의 특정 URL(`http://prometheus:9090/api/v1/write`)로 실시간 푸시(Push; Remote Write)하는 방식을 채택합니다.
- **Grafana 대시보드 추가**: Prometheus 서버가 전송받은 부하 지표를 시각화하기 위해 공식 k6 대시보드(**ID: 19665**)를 Data Source(Prometheus)로 성공적으로 불러왔습니다.

  ![k6 Grafana Dashboard Result](./images/k6-grafana-result.png)
  _그라파나에서 실시간으로 수집되는 k6 부하 테스트 지표 현황_

  | docker compose --profile 로 실행한 이미지는 종료하기 위해서는 다음 명령어 이용 `docker compose --profile test down`

### ⑥ k6 부하 테스트 로그 해석 가이드

`baseline.js`

```js title:baseline.js
export const options = {
  scenarios: {
    baseline: {
      executor: "constant-vus",
      vus: 100, // 100명 동시 요청
      duration: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // 에러율 1% 미만
    http_req_duration: ["p(95)<1000"], // 95%ile 응답시간 1초 미만
  },
};
```

> k6 컨테이너 실행 직후 터미널에 출력되는 최종 로그 텍스트를 분석하는 방법입니다.

```text
k6  |   █ THRESHOLDS
k6  |     http_req_failed
k6  |     ✓ 'rate<0.01' rate=0.00%
```

- **THRESHOLDS (성공 임계치)**: 스크립트 옵션에 걸어둔 `http_req_failed` 에러율(< 1%) 통과 여부를 보여줍니다. 실패율이 0%가 나왔으므로 통과(✓)했습니다.

```text
k6  |     checks_total.......: 820     81.11252/s
k6  |     checks_succeeded...: 100.00% 820 out of 820
```

- **checks (검증 로직)**: 응답 `status is 200`을 검사하는 `check(res, ...)` 로직이 총 **820번** 수행되었고, 모든 응답(100%)이 HTTP 200 OK를 반환했습니다.

```text
k6  |     http_req_duration..............: avg=22.03ms  min=12.88ms  med=19.69ms  max=135.1ms  p(90)=27.11ms  p(95)=27.89ms
k6  |     http_reqs......................: 820    81.11252/s
```

- **http_req_duration (요청 소요 시간)**: 가장 중요한 지표입니다. 요청-응답의 전체 평균(avg)은 22.03ms이며, 최솟값(min) 12.88ms, 중앙값(med) 19.69ms, 최댓값(max) 135.1ms를 기록했습니다.
- 특히 **p(95)=27.89ms**는 하위 95%의 요청이 약 28ms 미만으로 처리가 완료되었음을 뜻합니다.
- **http_reqs (총 요청 수 / 초당 요청 수)**: 테스트가 진행된 10초 동안 총 **820개의 요청(http_reqs)**이 발생했으며 이는 **초당 약 81회(TPS: 81.1/s)** 수준의 부하입니다.

```text
k6  |     iteration_duration.............: avg=122.99ms min=113.61ms med=120.32ms max=252.62ms p(90)=127.64ms p(95)=128.82ms
k6  |     iterations.....................: 820    81.11252/s
k6  |     vus............................: 10     min=10       max=10
k6  |     vus_max........................: 10     min=10       max=10
```

- **iteration_duration**: 한 명의 가상 사용자가 "초기화 → API 요청 → 대기(sleep 0.1) → 반복" 한 바퀴를 도는 데 걸린 평균 시간입니다. 우리가 `sleep(0.1)` (100ms)을 걸어두었기 때문에 API 응답 시점(22ms)과 합하여 얼추 122ms가 평균 사이클이 되었습니다.
- **vus (가상 사용자)**: 우리가 지정한 대로 총 10 명의 가상 사용자(최소~최대)가 할당되어 활동했음을 보여줍니다.

### ⑦ PostgreSQL 모니터링 구축 (`postgres_exporter`)

- **작업 개요**: 부하 테스트 시 데이터베이스 상태(커넥션, 트랜잭션 등)를 확인하기 위해 `postgres_exporter`를 도입했습니다.
- **완료된 작업 (세부 내역)**:
  1. **보안 및 권한 설정 (`01_monitoring.sql`)**
     - 별도의 모니터링 전용 계정(`prometheus`)을 생성하여 데이터베이스 관리자 권한과 분리하는 최소 권한 원칙(Least Privilege)을 적용했습니다.
     - `GRANT pg_monitor TO prometheus;` 명령어를 통해 데이터베이스 시스템 모니터링 뷰(`pg_stat_*`)를 조회할 수 있는 읽기 전용 권한을 부여했습니다.
     - 쿼리 실행의 상세 통계(실행 시간, 캐시 히트율, 호출 횟수 등)를 수집하기 위해 `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` 명령어를 스크립트에 포함했습니다.

  2. **데이터베이스 엔진 설정 튜닝 (`postgresql.conf`)**
     - `shared_preload_libraries = 'pg_stat_statements'`를 설정하여 PostgreSQL 서버가 기동될 때 모니터링 모듈이 메모리에 함께 로드되도록 구성했습니다.
     - `pg_stat_statements.track = all` 옵션을 주어 최상위 쿼리는 물론, 저장 프로시저나 내부 함수에서 파생되는 하위 쿼리까지 모든 트래픽을 세밀하게 추적하도록 설정했습니다.
     - 도커 커스텀 네트워크 상에서 다른 컨테이너(Exporter)가 DB에 접속할 수 있도록 `listen_addresses = '*'` 옵션으로 네트워크 수신 상태를 개방했습니다.

  3. **Docker Compose 초기화 및 볼륨 구조 설계**
     - `postgres` 컨테이너의 `volumes` 설정에 호스트의 `01_monitoring.sql` 파일을 `/docker-entrypoint-initdb.d/` 디렉토리 하위로 마운트했습니다. 이를 통해 DB 최초 생성 시 자동으로 유저와 확장(Extension) 설치가 이뤄지도록 했습니다.
     - 커스텀 `postgresql.conf` 파일도 `/etc/postgresql/postgresql.conf`로 마운트하고, `command` 속성에 `-c config_file=...`를 주입하여 기본 설정 대신 튜닝된 환경으로 서버가 구동되도록 지시했습니다.

  4. **PostgreSQL Exporter 컨테이너 구성 및 인증 연결**
     - `prometheuscommunity/postgres-exporter` 이미지를 기반으로 서비스 구조를 만들었습니다.
     - 환경 변수 `DATA_SOURCE_NAME` 값에 `postgresql://prometheus:prometheus@postgres:5432/reservation?sslmode=disable` 형태의 연결 문자열(ConnectionString)을 주입했습니다. 이 문자열이 바로 앞서 1번 과정에서 생성한 전용 유저를 통해 `reservation` 데이터베이스에 안전하게 접속하는 핵심 열쇠입니다.

  5. **Prometheus 스크랩 연동 (`prometheus.yml`, Grafana)**
     - 구성된 Exporter에서 뿜어져 나오는 지표(`9187` 포트)를 Prometheus가 정기적으로 긁어가도록 `scrape_configs`에 `job_name: 'postgres'`를 추가했습니다.
     - 최종적으로 Grafana에서 오픈소스 PostgreSQL 템플릿 대시보드(ID: 9628 등)를 불러와 아래와 같이 시각화 구성을 마쳤습니다.

  ### 관계도

```
Prometheus ──scrape──▶ postgres_exporter ──query──▶ PostgreSQL
                       (별도 컨테이너)               (컨테이너)
                       :9187/metrics
```

- **🔥 트러블슈팅 (Troubleshooting)**:
  - **이슈 1. Grafana 대시보드 "No data" 발생**
    - **현상**: 데이터를 수집 중임에도 대시보드 그래프가 비어 있음.
    - **원인**: 임포트한 대시보드가 Kubernetes 환경에 맞춰져 있어 `$namespace`, `$release` 등의 환경 변수가 도커 컴포즈 환경과 불일치함.
    - **해결**: Dashboard Settings -> Variables에서 불필요한 변수를 제거/숨김 처리하고, `$instance` 값의 쿼리를 `label_values(pg_up, instance)`로, `$datname`을 `label_values(pg_stat_database_numbackends, datname)`으로 환경에 맞게 직접 수정.
  - **이슈 2. Exporter DB 인증 실패 (`Role "prometheus" does not exist`)**
    - **현상**: Exporter가 DB에 연결할 수 없어 지표를 가져오지 못함.
    - **원인**: 윈도우-도커 마운트 과정에서 `./init.sql`이 파일이 아닌 **폴더(Directory)**로 잘못 생성되어, PostgreSQL 초기화 엔진이 에러로 간주하고 `01_monitoring.sql` 등 유저 생성 스크립트 실행을 통째로 건너뜀(Skip).
    - **해결 방안 및 재발 방지**:
      1. 잘못된 `init.sql` 폴더를 삭제하고 정상적인 빈 파일로 교체.
      2. `docker compose down -v`를 통해 기존 꼬인 볼륨을 완전히 삭제하고 초기화 재시도.
      3. `docker-compose.yml`의 `postgres` 서비스에 `healthcheck`(pg_isready)를 추가하고, Exporter에 `depends_on: condition: service_healthy`를 설정하여 **DB가 완전히 준비된 후** Exporter가 구동되도록 실행 순서 동기화.

- **결론 및 시각화**:
  - 이제 Exporter가 포트 `9187`을 통해 DB 지표(`pg_stat_database_numbackends` 등)를 정상 방출하며, 그라파나 대시보드에서 모니터링이 가능합니다.

  ![PostgreSQL Grafana Dashboard Result](images/grafana-postgres-dashboard.png)
  _그라파나에서 실시간으로 수집되는 PostgreSQL 모니터링 지표 현황_

---

## 2. 향후 진행할 다음 단계 (Next Steps)

프로메테우스와 그라파나의 기본 작동 방식 및 PromQL, 대시보드 변수(Variable) 시스템에 익숙해지신 후, 다음 단계로 넘어갈 수 있습니다.

1. **대시보드 커스터마이징 및 고도화**
   - 현재 임포트한 대시보드 외에, 내 애플리케이션(예: 예약 시스템)에 특화된 커스텀 메트릭 표시
   - 알람(Alerting) 기능 설정 (서버 다운, CPU 초과 등)

2. **k6 성능 테스트 지표 연동**
   - 추후 Docker로 k6 성능 테스트 환경 구축
   - k6의 테스트 결과를 Prometheus를 통해 수집하고 Grafana에서 시각화하여 TPS, 응답 지연(Latency) 등을 분석

---
