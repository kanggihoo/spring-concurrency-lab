# Phase 2 구현 완료 요약 — 베이스라인 (동시성 처리 없음)

## 목적

락 없이 구현했을 때 발생하는 overselling 문제를 수치로 증명한다.

---

## 구현 완료 파일 목록

| Step | 파일 | 작업 | 상태 |
|------|------|------|------|
| 1 | `concurrency/build.gradle` | redis-test 제거, Testcontainers BOM 2.0.4, UTF-8 인코딩 설정 | ✅ |
| 2 | `concurrency/src/test/.../ReservationConcurrencyTest.java` | 동시성 테스트 (100 threads, overselling 증명) | ✅ |
| 3 | `concurrency/src/main/.../domain/Concert.java` | Entity — id, title, stock | ✅ |
| 3 | `concurrency/src/main/.../domain/Reservation.java` | Entity — id, concertId, userId, createdAt | ✅ |
| 4 | `concurrency/src/main/.../repository/ConcertRepository.java` | JpaRepository 상속 | ✅ |
| 4 | `concurrency/src/main/.../repository/ReservationRepository.java` | JpaRepository + countByConcertId | ✅ |
| 5 | `concurrency/src/main/.../service/ReservationService.java` | 락 없는 예약 로직 (의도적 Race Condition) | ✅ |
| 6 | 테스트 실행 | overselling 증명 완료 | ✅ |
| 7 | `concurrency/src/main/.../controller/ReservationRequest.java` | Java record DTO | ✅ |
| 7 | `concurrency/src/main/.../controller/ReservationController.java` | POST /api/reservations (200/409) | ✅ |
| 8 | `concurrency/src/main/.../controller/TestController.java` | POST /api/test/reset 추가 | ✅ |
| 9 | `postgres/init/02_schema.sql` | concert, reservation 테이블 + 초기 데이터 | ✅ |
| 9 | `docker-compose.yml` | 02_schema.sql volume 마운트 추가 | ✅ |
| 10 | `scripts/baseline.js` | setup()에 /api/test/reset 호출 추가 | ✅ |

---

## 프로젝트 구조 (Phase 2 완료 시점)

```
concurrency/src/main/java/com/example/concurrency/
├── ConcurrencyApplication.java
├── controller/
│   ├── ReservationController.java    # POST /api/reservations
│   ├── ReservationRequest.java       # record DTO
│   └── TestController.java           # GET /api/test, POST /api/test/reset
├── domain/
│   ├── Concert.java                  # Entity (no @Version, no lock)
│   └── Reservation.java             # Entity
├── repository/
│   ├── ConcertRepository.java
│   └── ReservationRepository.java
└── service/
    └── ReservationService.java       # No lock — intentional race condition
```

---

## 1. 단위 테스트 — 동시성 정합성 검증

### 1-1. 테스트 실행 방법

```bash
# 사전 조건: Docker Desktop이 실행 중이어야 한다 (Testcontainers가 Docker로 PostgreSQL을 띄우므로)

# 프로젝트 루트에서 실행
cd concurrency

# 동시성 테스트만 실행
./gradlew clean test --tests "com.example.concurrency.ReservationConcurrencyTest" --info
```

> `--info` 옵션을 붙이면 `System.out.println` 출력을 터미널에서 직접 확인할 수 있다.

### 1-2. 테스트 코드 동작 흐름

테스트는 크게 **환경 준비 → 동시 실행 → 결과 검증** 3단계로 구성된다.

#### Phase A: 환경 준비 (Testcontainers + @BeforeEach)

```
1. @Testcontainers + @Container
   → JUnit이 테스트 시작 전에 Docker로 PostgreSQL 17-alpine 컨테이너를 자동으로 띄움
   → 테스트 종료 후 컨테이너 자동 삭제

2. @ServiceConnection
   → 띄워진 PostgreSQL 컨테이너의 랜덤 포트를 Spring의 datasource에 자동 연결
   → application.yml의 DB 설정을 오버라이드 (별도 설정 불필요)

3. @BeforeEach setUp()
   → reservationRepository.deleteAll()  : 이전 테스트 데이터 정리
   → concert가 없으면 생성, 있으면 stock=100으로 리셋
   → 매 테스트마다 동일한 초기 상태 보장
```

#### Phase B: 동시 실행 (100 threads, CountDownLatch)

```
1. ExecutorService executor = Executors.newFixedThreadPool(100)
   → 100개의 스레드를 가진 스레드 풀 생성

2. CountDownLatch latch = new CountDownLatch(100)
   → 100개의 스레드가 모두 완료될 때까지 메인 스레드가 대기하기 위한 장치

3. for (i = 0; i < 100; i++)
   └─ executor.submit(() -> {
        reservationService.reserve(1L, userId);  // 예약 시도
        latch.countDown();                       // 완료 시 카운트 감소
      })
   → 100개의 스레드가 거의 동시에 reserve() 호출

4. latch.await()
   → 100개의 스레드가 모두 끝날 때까지 메인 스레드 대기
```

#### Phase C: 결과 검증

```
Concert concert = concertRepository.findById(1L)  → DB에서 최신 재고 조회
long reservationCount = reservationRepository.countByConcertId(1L)  → 실제 예약 건수

assertThat(reservationCount + concert.getStock()).isNotEqualTo(100)
  → 예약 수 + 남은 재고 ≠ 100이면 정합성이 깨진 것 → 테스트 PASS (overselling 증명)
```

### 1-3. 왜 overselling이 발생하는가 — 상세 원인 분석

#### ReservationService.reserve()의 동작

```java
@Transactional
public void reserve(Long concertId, Long userId) {
    Concert concert = concertRepository.findById(concertId).orElseThrow();  // ① SELECT
    if (concert.getStock() <= 0) { throw ... }                              // ② CHECK
    concert.decreaseStock();                                                // ③ 메모리에서 stock--
    reservationRepository.save(new Reservation(concertId, userId));          // ④ INSERT
}   // ⑤ 트랜잭션 커밋 → JPA Dirty Checking → UPDATE concert SET stock = ? WHERE id = ?
```

#### 동시 접근 시 타임라인 (Lost Update)

```
시간  Thread A (userId=1)              Thread B (userId=2)              DB stock
────  ──────────────────────────────  ──────────────────────────────  ──────────
t1    ① SELECT → stock=100                                            100
t2                                    ① SELECT → stock=100            100
t3    ② CHECK → 100 > 0 ✓                                             100
t4                                    ② CHECK → 100 > 0 ✓            100
t5    ③ stock-- (메모리: 99)                                           100
t6    ④ INSERT reservation                                             100
t7                                    ③ stock-- (메모리: 99)          100
t8                                    ④ INSERT reservation            100
t9    ⑤ COMMIT → UPDATE stock=99                                       99
t10                                   ⑤ COMMIT → UPDATE stock=99      99 ← !!!
```

**핵심 문제**: Thread B가 t2에서 읽은 stock=100을 기준으로 99를 계산하여 UPDATE한다.
Thread A가 이미 stock을 99로 변경했지만, Thread B는 이 변경을 모르고 **같은 값 99로 덮어쓴다**.

결과: 예약은 2건이 생성됐지만 재고는 1만 줄어들었다 → **Lost Update**.

이것이 100개 스레드에서 동시에 발생하면:
- 예약 건수: 100 (모두 성공)
- 재고 차감: 9~13 (대부분의 UPDATE가 덮어씌워짐)
- 정합성 오류: 87~91건

#### 왜 PostgreSQL의 기본 트랜잭션 격리 수준으로도 막을 수 없는가

PostgreSQL의 기본 격리 수준은 **READ COMMITTED**이다.

- READ COMMITTED는 **다른 트랜잭션이 커밋한 데이터는 읽을 수 있게** 허용한다
- 그러나 **읽기 시점과 쓰기 시점 사이의 간격**(①~⑤)에서 다른 트랜잭션이 끼어들 수 있다
- JPA의 UPDATE는 `UPDATE concert SET stock=99 WHERE id=1` 형태로, **현재 DB 값과 무관하게** 메모리에서 계산한 값으로 덮어쓴다
- 이것이 **Lost Update (Second Lost Update Problem)** 이다

해결책은 Phase 3에서 다룬다:
- 비관적 락: `SELECT ... FOR UPDATE`로 읽기 시점에 락을 걸어 다른 트랜잭션의 접근 차단
- 낙관적 락: `@Version`으로 UPDATE 시 충돌 감지 → 재시도

### 1-4. 테스트 결과

```
Remaining stock: 87~91 (runs vary)
Reservation count: 100
Integrity error: 87~91
```

- 100명이 동시 예약 → 100건 모두 예약 성공
- 그러나 재고는 9~13만 차감됨 (87~91건의 lost update 발생)
- `reservationCount + stock ≠ 100` → 정합성 완전히 깨짐
- 실행마다 결과가 다름 (race condition은 비결정적)

---

## 2. k6 부하 테스트 — HTTP 레벨 동시성 확인

### 2-1. 사전 준비

```bash
# 1. Docker Compose로 인프라 실행 (PostgreSQL, Prometheus, Grafana 등)
docker compose up -d

# 2. Spring Boot 앱 로컬 실행
cd concurrency
./gradlew bootRun

# 3. 서버 정상 동작 확인
curl http://localhost:8080/api/test
# → {"message":"Load test API is working!"}

# 4. DB 초기 데이터 확인 (concert가 있는지)
curl -X POST http://localhost:8080/api/test/reset
# → {"status":"reset","stock":"100"}
```

### 2-2. k6 부하 테스트 실행

```bash
# 프로젝트 루트 디렉토리에서 실행

# baseline.js — 100 VU, 10초간 동시 예약 요청
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/baseline.js
```

#### baseline.js의 동작 흐름

```
1. setup() 단계 (테스트 시작 전 1회 실행)
   → POST /api/test/reset 호출
   → DB의 reservation 테이블 비우고 concert stock을 100으로 리셋

2. default function (100 VU × 10초간 반복 실행)
   → 각 VU가 POST /api/reservations { concertId: 1, userId: __VU } 를 반복 호출
   → 100명의 가상 유저가 10초 동안 계속해서 예약 요청을 보냄
   → 총 수천~수만 건의 요청이 서버로 전달됨

3. check() 결과 검증
   → 각 응답이 200(예약 성공) 또는 409(재고 소진)인지 확인
   → 200도 아니고 409도 아니면 예상치 못한 오류
```

### 2-3. 테스트 결과 확인 방법

#### 방법 1: k6 터미널 출력

k6 실행이 끝나면 터미널에 아래와 같은 요약이 출력된다:

```
         /\      |‾‾| /‾‾/   /‾‾/
    /\  /  \     |  |/  /   /  /
   /  \/    \    |     (   /   ‾‾\
  /          \   |  |\  \ |  (‾)  |
 / __________ \  |__| \__\ \_____/ .io

     checks.........................: XX.XX% ✓ XXXX   ✗ XXXX
     http_req_duration..............: avg=XXms  min=XXms  med=XXms  max=XXXms  p(90)=XXms  p(95)=XXms
     http_req_failed................: XX.XX%  ✓ XXXX   ✗ XXXX
     http_reqs......................: XXXX    XXX.XX/s (RPS)
     vus............................: 100     min=100  max=100
```

확인할 핵심 지표:
| 지표 | 의미 | Phase 2 기대값 |
|------|------|----------------|
| `http_reqs` | 총 요청 수 / 초당 처리량(RPS) | 높음 (락이 없어서 빠름) |
| `http_req_duration p(95)` | 95%ile 응답시간 | 매우 낮음 |
| `http_req_failed` | 실패율 | 0%에 가까움 (모두 성공, 재고 소진 후 409) |
| `checks` | 200 또는 409 비율 | 대부분 200 |

#### 방법 2: PostgreSQL에서 직접 정합성 확인

k6 테스트 종료 후 DB에 접속해서 overselling 여부를 확인한다:

```bash
# Docker 내부의 PostgreSQL에 접속
docker exec -it postgres psql -U user -d reservation
```

```sql
-- 정합성 확인 쿼리
SELECT
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1) AS reservation_count,
    (SELECT 100 - stock FROM concert WHERE id = 1)           AS stock_deducted,
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1)
        - (SELECT 100 - stock FROM concert WHERE id = 1)    AS inconsistency;

-- 결과 예시:
-- reservation_count | stock_deducted | inconsistency
-- ------------------+----------------+---------------
--              3847 |             98 |          3749
--
-- → 3847건 예약됐는데 재고는 98만 줄어듬
-- → 3749건의 정합성 오류 (overselling)
```

> 단위 테스트(100 threads × 1회)와 달리, k6는 100 VU가 10초간 반복하므로
> 수천 건의 예약이 생성되며 overselling 규모가 훨씬 크다.

#### 방법 3: Grafana 대시보드에서 시각화

```
1. 브라우저에서 http://localhost:3000 접속
2. 로그인: admin / admin
3. 좌측 메뉴 → Dashboards → 기존 대시보드 선택 또는 새로 생성
```

Prometheus에서 수집 가능한 주요 지표:

| Prometheus 쿼리 | 의미 |
|-----------------|------|
| `rate(http_server_requests_seconds_count[1m])` | Spring 서버의 초당 요청 처리량 |
| `http_server_requests_seconds_bucket` | 응답시간 분포 (히스토그램) |
| `hikaricp_connections_active` | DB 커넥션 풀 사용 중인 커넥션 수 |
| `hikaricp_connections_pending` | DB 커넥션 대기 중인 요청 수 |
| `k6_http_req_duration_p95` | k6에서 측정한 p95 응답시간 |
| `k6_http_reqs_total` | k6에서 측정한 총 요청 수 |

### 2-4. 다른 시나리오로 테스트

```bash
# spike.js — 2초만에 500명 폭주
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/spike.js

# ramp-up.js — 점진적 증가로 한계점 탐색
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/ramp-up.js

# sustained.js — 200 VU 5분간 지속 부하
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/sustained.js
```

> 매 테스트 전에 reset을 자동으로 호출하도록 baseline.js에 `setup()` 함수가 포함되어 있다.
> 다른 스크립트(spike.js, ramp-up.js, sustained.js)에서도 setup()을 추가하면
> 테스트 시작 전 자동 초기화된다.

### 2-5. Phase 2 k6 테스트에서 기대되는 결과

| 항목 | 기대값 | 이유 |
|------|--------|------|
| RPS | 높음 | 락이 없어서 DB 쓰기가 빠르게 처리됨 |
| p95 응답시간 | 낮음 | 락 대기 없음 |
| 에러율 | 낮음 | 대부분의 요청이 성공 (재고가 잘못 관리되므로) |
| 정합성 | **깨짐** | 수천 건의 예약이 생성되지만 재고는 일부만 차감됨 |

**핵심 인사이트**: Phase 2의 성능은 좋아 보이지만, **정합성이 완전히 깨져 있다**.
"빠르지만 데이터가 틀린" 시스템은 의미가 없다.
Phase 3에서 락을 적용하면 정합성은 보장되지만 성능이 어떻게 달라지는지 비교한다.

---

## 다음 단계 (Phase 3)

- 비관적 락 (SELECT FOR UPDATE) 적용
- 낙관적 락 (@Version) 적용
- 동일한 동시성 테스트로 정합성 보장 확인
- k6 부하 테스트로 Phase 2 대비 성능 수치 비교
