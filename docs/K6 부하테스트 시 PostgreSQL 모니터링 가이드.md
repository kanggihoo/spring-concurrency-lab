
## 0. 설정 

### PostgreSQL 도커 설정
#### 1. postgres_exporter가 접근할 수 있도록 PostgreSQL 설정 필요

postgres_exporter는 PostgreSQL의 `pg_stat_*` 뷰를 조회하는 방식으로 동작하기 때문에, **전용 모니터링 유저**를 만들어줘야 함.

#### 2. 초기화 SQL 스크립트 작성

sql

```sql title:init/01_monitoring.sql
-- init/01_monitoring.sql

-- 모니터링 전용 유저 생성
CREATE USER prometheus WITH PASSWORD 'prometheus';

-- pg_stat 뷰 조회 권한 부여 (PostgreSQL 10+)
GRANT pg_monitor TO prometheus;

-- pg_stat_statements 활성화 (슬로우 쿼리 추적용)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```


#### 3. PostgreSQL 설정 파일 (postgresql.conf)

`pg_stat_statements` 를 활성화하려면 설정 파일에 명시해야 합니다.

```conf
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'  # 슬로우 쿼리 추적 활성화

pg_stat_statements.track = all                   # 모든 쿼리 추적
pg_stat_statements.max = 10000                   # 추적할 쿼리 수
track_activity_query_size = 2048                 # 쿼리 텍스트 저장 길이
```

---

#### 4. docker-compose.yml 구성

yaml

```yaml title:docker-compse.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    volumes:
      - ./postgres/init:/docker-entrypoint-initdb.d  # 초기화 SQL 자동 실행
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"

  postgres_exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://prometheus:prometheus@postgres:5432/mydb?sslmode=disable"
    ports:
      - "9187:9187"
    depends_on:
      - postgres
```


```ad-question  
exporter도 별도로 도커 띄워야하는거야??

	


```

네, **postgres_exporter는 별도 컨테이너로 띄워야 합니다.**
### 이유

```
PostgreSQL 컨테이너
  → pg_stat_* 뷰 데이터는 있지만
  → Prometheus가 읽을 수 있는 형식(/metrics)으로 
    노출하는 기능이 없음

postgres_exporter 컨테이너
  → PostgreSQL에 접속해서 pg_stat_* 조회
  → Prometheus 형식으로 변환해서 노출
  → Prometheus가 여기서 수집해감
```
### 관계도

```
Prometheus ──scrape──▶ postgres_exporter ──query──▶ PostgreSQL
                       (별도 컨테이너)               (컨테이너)
                       :9187/metrics
```


## 1. Connection Pool 메트릭 (HikariCP)

Spring은 HikariCP를 기본 커넥션 풀로 사용하며, `micrometer` + `spring-boot-actuator`로 자동 노출됩니다.

| 메트릭 | 설명 |
|---|---|
| `hikaricp_connections_active` | 현재 사용 중인 커넥션 수 |
| `hikaricp_connections_idle` | 유휴 커넥션 수 |
| `hikaricp_connections_pending` | 커넥션 대기 중인 스레드 수 |
| `hikaricp_connections_max` | 최대 커넥션 풀 사이즈 |
| `hikaricp_connections_min` | 최소 커넥션 풀 사이즈 |
| `hikaricp_connections_timeout_total` | 커넥션 획득 타임아웃 발생 횟수 |
| `hikaricp_connections_acquire_seconds` | 커넥션 획득 소요 시간 |
| `hikaricp_connections_usage_seconds` | 커넥션 사용 시간 |
| `hikaricp_connections_creation_seconds` | 커넥션 생성 소요 시간 |

> [!important] 병목 탐지의 핵심 지표
> #### hikaricp_connections_pending
> 커넥션 대기 스레드 수 — 부하테스트 시 **병목 지점 탐지의 핵심**
>
> #### hikaricp_connections_timeout_total
> 커넥션 획득 타임아웃 횟수 — **에러 탐지의 핵심**

---

## 2. PostgreSQL 서버 메트릭 (postgres_exporter)

`prometheus-community/postgres_exporter`를 설치해서 수집합니다.

### 커넥션 관련

| 메트릭 | 설명 |
|---|---|
| `pg_stat_database_numbackends` | DB별 현재 연결 수 |
| `pg_settings_max_connections` | PostgreSQL 최대 커넥션 설정값 |

### 쿼리/트랜잭션 성능

| 메트릭 | 설명 |
|---|---|
| `pg_stat_database_xact_commit` | 커밋된 트랜잭션 수 (rate로 TPS 계산) |
| `pg_stat_database_xact_rollback` | 롤백된 트랜잭션 수 |
| `pg_stat_database_tup_fetched` | 실제 fetch된 row 수 |
| `pg_stat_database_tup_returned` | 스캔된 row 수 (fetched 대비 크면 비효율적 쿼리) |
| `pg_stat_database_tup_inserted` | INSERT된 row 수 |
| `pg_stat_database_tup_updated` | UPDATE된 row 수 |
| `pg_stat_database_tup_deleted` | DELETE된 row 수 |

> [!warning] 에러 핵심 지표
> `pg_stat_database_xact_rollback` — 롤백 수 급증 시 트랜잭션 충돌 의심

### 캐시 효율

| 메트릭 | 설명 |
|---|---|
| `pg_stat_database_blks_hit` | 버퍼 캐시 히트 수 |
| `pg_stat_database_blks_read` | 디스크에서 읽은 블록 수 |
| `pg_stat_bgwriter_buffers_alloc` | 버퍼 할당 수 |

> [!tip] 캐시 히트율 계산
> `blks_hit / (blks_hit + blks_read)` → **95% 이상이 정상**

### Lock / 대기

| 메트릭 | 설명 |
|---|---|
| `pg_locks_count` | Lock 타입별 현재 lock 수 |
| `pg_stat_database_deadlocks` | 데드락 발생 수 |
| `pg_stat_database_conflicts` | 복제 충돌 수 |

> [!warning] 에러 핵심 지표
> `pg_stat_database_deadlocks` — 데드락 발생 수 급증 시 즉시 점검 필요

### 테이블/인덱스 스캔

| 메트릭 | 설명 |
|---|---|
| `pg_stat_user_tables_seq_scan` | Sequential scan 수 (많으면 인덱스 미사용) |
| `pg_stat_user_tables_idx_scan` | Index scan 수 |
| `pg_stat_user_tables_n_live_tup` | 테이블 live row 수 |

---

## 3. 시스템 리소스 메트릭 (node_exporter)

| 메트릭 | 설명 |
|---|---|
| `node_cpu_seconds_total` | CPU 사용률 |
| `node_memory_MemAvailable_bytes` | 가용 메모리 |
| `node_disk_io_time_seconds_total` | 디스크 I/O 시간 |
| `node_disk_read/write_bytes_total` | 디스크 Read/Write 바이트 |

> [!warning] DB 병목의 주범
> 디스크 I/O (iowait) 급증은 PostgreSQL 병목의 가장 흔한 원인입니다.

---

## 4. 핵심 모니터링 시나리오

```
부하 증가 → hikaricp_connections_pending 증가
         → pg_stat_database_numbackends 증가
         → pg_locks_count 증가 (경합)
         → pg_stat_database_deadlocks 발생
         → pg_stat_user_tables_seq_scan 증가 (쿼리 비효율)
         → blks_read 증가, 캐시 히트율 하락
```

### 진단 흐름

```
응답시간 느림 (http_server_requests_seconds 증가)
        │
        ├─ hikaricp_connections_pending 증가
        │         → 커넥션 풀 부족  →  pool size 늘리기
        │
        ├─ pg_stat_database_deadlocks 증가
        │         → 쿼리 간 락 충돌  →  트랜잭션 범위 줄이기
        │
        ├─ blks_hit 히트율 하락
        │         → DB 캐시 부족  →  shared_buffers 늘리기
        │
        ├─ node iowait 증가
        │         → 디스크 I/O 포화  →  SSD 전환 or 쿼리 최적화
        │
        └─ jvm_gc_pause 증가
                  → GC 과부하  →  힙 메모리 늘리기
```

---

## 5. 수집 스택 구성

```
Spring Boot App ──(micrometer)──▶ /actuator/prometheus
                                          │
PostgreSQL ──(postgres_exporter)──▶ :9187/metrics    ──▶ Prometheus ──▶ Grafana
                                          │
DB 서버 OS ──(node_exporter)──▶ :9100/metrics
```

---

## 6. postgres_exporter 설정

### docker-compose.yml

```yaml
services:
  postgres_exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://user:password@postgres:5432/dbname?sslmode=disable"
    ports:
      - "9187:9187"
```

### prometheus.yml

```yaml
scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres_exporter:9187']
```

수집되는 주요 메트릭:
- `pg_stat_database_*` (트랜잭션, 캐시 히트율, deadlock 등)
- `pg_stat_user_tables_*` (seq scan, idx scan 등)
- `pg_locks_count`
- `pg_settings_max_connections`

---

## 7. node_exporter 설정

> [!question] node_exporter가 측정하는 OS
> **Q.** Spring은 로컬, K6/Prometheus/PostgreSQL이 Docker에서 동작할 때 node_exporter는 어느 OS를 측정하나요?
>
> **A.** **Docker가 실행되고 있는 호스트 OS**를 측정합니다.
>
> ```
> [로컬 호스트 OS]  ← node_exporter가 여기를 측정
>       │
>       ├── Spring (로컬에서 직접 실행)
>       └── Docker Engine
>               ├── K6 컨테이너
>               ├── Prometheus 컨테이너
>               └── PostgreSQL 컨테이너
>                         ↑
>                   컨테이너는 호스트 OS의
>                   CPU/메모리/디스크를 공유해서 사용
> ```
> 컨테이너는 독립적인 OS가 아니라 호스트 OS의 자원을 나눠 쓰는 구조이기 때문에, node_exporter로 호스트를 측정하면 PostgreSQL 컨테이너가 사용하는 리소스도 함께 잡힙니다.

> [!warning] Mac/Windows 환경 주의사항
> Docker Desktop은 내부적으로 Linux VM을 띄워 그 위에서 컨테이너를 실행합니다. 따라서 node_exporter가 측정하는 것은 **그 Linux VM의 리소스**이며, 실제 Mac/Windows 하드웨어 정보와 다소 차이가 날 수 있습니다.

### docker-compose.yml

```yaml title:docker-compose.yml
services:
  node_exporter:
    image: prom/node-exporter
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
    ports:
      - "9100:9100"
```

### prometheus.yml

```yaml title:prometheus.yml
scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node_exporter:9100']
```

> [!info] 개인 로컬 환경에서의 우선순위
> ```
> 반드시 필요   → Spring Actuator (HikariCP, 응답시간)
> 반드시 필요   → postgres_exporter (DB 내부 상태)
> 있으면 좋음   → node_exporter (OS 리소스)
> ```
> 개인 로컬 환경에서는 Mac Activity Monitor / Windows 작업관리자로도 CPU, 메모리, 디스크 I/O를 확인할 수 있어 node_exporter 없이도 충분히 부하테스트 분석이 가능합니다.

---

## 8. 부하테스트 필수 수집 항목 요약

### K6 → Spring (애플리케이션 레벨)

```
http_server_requests_seconds        — API 응답시간 (p50, p95, p99)
http_server_requests_seconds_count  — 초당 요청 수 (TPS)
hikaricp_connections_active         — 현재 사용중인 DB 커넥션
hikaricp_connections_pending        — 커넥션 대기 스레드 수  ★병목 핵심
hikaricp_connections_timeout_total  — 커넥션 획득 실패 횟수  ★에러 핵심
jvm_memory_used_bytes               — 힙 메모리 사용량
jvm_gc_pause_seconds                — GC로 인한 Stop-the-world 시간
```

### PostgreSQL 내부 (postgres_exporter)

```
pg_stat_database_xact_commit        — TPS (rate로 계산)
pg_stat_database_xact_rollback      — 롤백 수  ★에러 핵심
pg_stat_database_numbackends        — 현재 DB 연결 수
pg_stat_database_deadlocks          — 데드락 발생 수  ★에러 핵심
pg_stat_database_blks_hit           — 캐시 히트
pg_stat_database_blks_read          — 디스크 읽기
   → 히트율 = blks_hit / (blks_hit + blks_read)  ★95% 이상이 정상
```

### 서버 OS (node_exporter)

```
CPU 사용률                          — 전체 부하 확인
메모리 가용량                       — OOM 위험 감지
디스크 I/O (iowait)                — DB 병목의 주범
```

---

## 9. K6 수집 지표

### 요청/응답 관련

| 메트릭 | 설명 | 왜 필요한가 |
|---|---|---|
| `k6_http_req_duration` | 전체 응답시간 | p95, p99로 사용자 체감 속도 |
| `k6_http_req_waiting` | TTFB (서버 처리시간) | 네트워크 제외 순수 서버 처리 시간 |
| `k6_http_req_sending` | 요청 전송 시간 | 네트워크 병목 여부 |
| `k6_http_req_receiving` | 응답 수신 시간 | 네트워크 병목 여부 |
| `k6_http_reqs_total` | 총 요청 수 | TPS 계산 |
| `k6_http_req_failed` | 실패한 요청 비율 | 에러율 |

### 가상 유저 관련

| 메트릭 | 설명 | 왜 필요한가 |
|---|---|---|
| `k6_vus` | 현재 활성 VU 수 | 부하량 기준선 |
| `k6_vus_max` | 최대 VU 수 | 테스트 최대 부하 확인 |
| `k6_iterations_total` | 시나리오 반복 횟수 | 처리량 확인 |
| `k6_iteration_duration` | 시나리오 1회 소요시간 | 전체 플로우 응답시간 |

### 네트워크 관련

| 메트릭 | 설명 |
|---|---|
| `k6_data_sent_total` | 전송된 데이터량 |
| `k6_data_received_total` | 수신된 데이터량 |

> [!tip] 응답시간 분해 구조
> 응답시간이 느릴 때 **어느 구간에서 느린지** 파악하는 핵심입니다.
>
> ```
> k6_http_req_duration (전체)
> │
> ├── k6_http_req_sending      (클라이언트 → 서버 전송)
> ├── k6_http_req_waiting      (서버 처리 = 순수 백엔드 시간) ★
> └── k6_http_req_receiving    (서버 → 클라이언트 수신)
>
> waiting이 크면 → Spring/DB 문제
> sending/receiving이 크면 → 네트워크 문제
> ```

---

## 10. Grafana 대시보드 구성 전략

### 추천 대시보드 ID

| ID | 대상 | 용도 |
|---|---|---|
| `19665` | K6 | 부하 테스트 결과 |
| `4701` | Spring JVM | GC, 힙, 스레드 |
| `6083` | HikariCP | 커넥션 풀 상세 |
| `9628` | PostgreSQL | DB 트랜잭션, 락, 캐시 |
| `1860` | Node Exporter | OS 리소스 (선택) |
| **직접제작** | Overview | K6 + Spring + DB 핵심지표 통합 |

> [!info] Overview 대시보드를 직접 만드는 이유
> 임포트한 대시보드들은 수정하면 재임포트 시 덮어씌워지고, 패널이 너무 많아 부하테스트 중 실시간으로 보기에 과합니다. Overview는 **"지금 병목이 어디냐"** 만 보이도록 핵심 5~7개 패널만 직접 구성합니다.
>
> ```
> 하나의 대시보드에 전부 넣으면...
> - 패널이 30~50개 이상 → 로딩 느림
> - 보고 싶은 지표 찾기 어려움
> - 부하테스트 중 실시간으로 보기 불편
> - 각 대시보드가 이미 최적화된 레이아웃인데 합치면 그 구조가 깨짐
> ```

### Overview 대시보드 추천 패널 구성

```
┌─────────────────┬─────────────────┬─────────────────┐
│  k6_vus         │  TPS            │  에러율         │
│  (현재 VU 수)   │  (http_reqs)    │  (req_failed)   │
├─────────────────┼─────────────────┼─────────────────┤
│  응답시간 p95   │  HikariCP       │  DB 캐시        │
│  (req_duration) │  pending        │  히트율         │
├─────────────────┼─────────────────┼─────────────────┤
│  req_waiting    │  DB 데드락      │  JVM 힙 사용량  │
│  (서버처리시간) │  (deadlocks)    │                 │
└─────────────────┴─────────────────┴─────────────────┘
```
