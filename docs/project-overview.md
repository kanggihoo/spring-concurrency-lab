# 동시성 처리 비교 학습 로드맵

> k6 + Prometheus + Grafana 기반으로 DB 락 vs Redis 동시성 처리 성능을 수치로 비교하는 프로젝트

---

## 🛠 기술 스택 (Tech Stack)

### Backend

- **Framework**: Spring Boot 4.x
- **Build Tool**: Gradle 8.14.x
- **Language**: Java 21 (LTS)
- **Libraries**: Spring Data JPA, Spring Data Redis, Redisson (분산 락), Micrometer Prometheus
- **Testing**: JUnit 5, Testcontainers, Spring Boot Test, AssertJ

### Infrastructure (Docker Container)

- **RDBMS**: PostgreSQL 17-alpine
- **Distributed Lock / Cache**: Redis 7.2-alpine
- **Monitoring**: Prometheus (latest), Grafana (latest)
- - **Load Testing**: k6 (latest)

### Testing & Visualization

- **Unit / Integration Test**: JUnit 5 + Testcontainers (TDD)
- **Performance Metrics**: Prometheus + Grafana Integration

---

## 🎯 목표

- DB 락(비관적/낙관적)과 Redis 분산락의 성능 차이를 **실제 수치로 측정**
- "DB만으로도 동시성 처리가 되지 않나?"에 대한 답을 직접 증명
- 예약/주문 시스템 같은 동시성이 필요한 도메인에서 **어떤 방식이 언제 적합한지** 판단 기준 확립
- TDD 방식으로 동시성 정합성을 **자동화된 테스트로 검증**

### 비교 시나리오 (전 단계 고정)

```
콘서트 예약 시스템 — 잔여 좌석 100석, 1000명이 동시에 예약 시도

POST /api/reservations
  → 잔여석 확인
  → 차감
  → 예약 완료
```

---

## Phase 1. 환경 구축

### 1-1. 모니터링 스택 구성

k6 + Prometheus + Grafana를 Docker Compose로 한 번에 구성한다.

k6도 Docker 이미지(`grafana/k6`)를 사용하므로, 별도 로컬 설치 없이 하나의 `docker-compose.monitoring.yml`로 전체 모니터링 스택을 관리한다.

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    extra_hosts:
      - "host.docker.internal:host-gateway" # 로컬 Spring 서버 접근용

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  k6:
    image: grafana/k6
    volumes:
      - ./scripts:/scripts # 로컬 scripts 폴더를 컨테이너에 마운트
    depends_on:
      - prometheus
    environment:
      - K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
    # 실행할 스크립트를 지정 (필요에 따라 변경)
    command: run --out experimental-prometheus-rw /scripts/baseline.js
    extra_hosts:
      - "host.docker.internal:host-gateway" # 로컬 Spring 서버 접근용
    profiles:
      - k6 # 기본 실행에서는 제외, 필요할 때만 실행
```

> **`profiles: k6` 사용 이유**
> Prometheus/Grafana는 항상 띄워두고, k6는 테스트 실행 시에만 올리기 위해 profile로 분리한다.
> 이렇게 하면 테스트 스크립트나 시나리오를 바꿔가며 k6만 재실행할 수 있다.

```yaml
# prometheus.yml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "spring"
    static_configs:
      - targets: ["host.docker.internal:8080"] # 로컬에서 실행 중인 Spring Boot
    metrics_path: "/actuator/prometheus"

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "k6"
    static_configs:
      - targets: ["k6:6565"] # k6 내장 HTTP 메트릭 서버
```

#### 실행 명령어

```bash
# 1. Prometheus + Grafana만 실행 (항상 떠있는 모니터링 서버)
docker compose -f docker-compose.monitoring.yml up -d

# 2. k6 테스트 실행 (실행할 스크립트를 command로 오버라이드)
docker compose -f docker-compose.monitoring.yml \
  --profile k6 run --rm \
  k6 run --out experimental-prometheus-rw /scripts/baseline.js

# 3. 다른 시나리오로 실행 (스크립트만 바꿔서)
docker compose -f docker-compose.monitoring.yml \
  --profile k6 run --rm \
  k6 run --out experimental-prometheus-rw /scripts/spike.js
```

### 1-2. 애플리케이션 스택 구성

Spring Boot + PostgreSQL + Redis를 Docker Compose로 구성한다.

```yaml
# docker-compose.app.yml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: reservation
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    ports:
      - "9187:9187"
    environment:
      DATA_SOURCE_NAME: "postgresql://user:password@postgres:5432/reservation?sslmode=disable"
    depends_on:
      - postgres
```

### 1-3. DB 모니터링 설정

PostgreSQL에서 쿼리 통계와 실행계획 자동 수집을 활성화한다.

```sql
-- postgresql.conf (또는 init.sql에 추가)
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,auto_explain';
ALTER SYSTEM SET auto_explain.log_min_duration = '500ms';
ALTER SYSTEM SET auto_explain.log_analyze = true;

-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### 1-4. Spring 의존성 설정

```gradle
// build.gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'io.micrometer:micrometer-registry-prometheus'

    // Redis (Phase 4에서 사용)
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'
    implementation 'org.redisson:redisson-spring-boot-starter:3.24.3'

    runtimeOnly 'org.postgresql:postgresql'

    // Testing
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.testcontainers:junit-jupiter'
    testImplementation 'org.testcontainers:postgresql'
    testImplementation 'com.redis:testcontainers-redis:2.2.2'
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: prometheus,health,metrics
  metrics:
    export:
      prometheus:
        enabled: true
```

### 1-5. 테스트 초기화 API

테스트를 반복 실행할 때 DB/Redis 상태를 초기화하는 엔드포인트를 만든다.

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/test")
public class TestResetController {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/reset")
    public ResponseEntity<Void> resetForTest() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElseThrow();
        concert.setStock(100);
        concertRepository.save(concert);

        // Redis 재고도 초기화 (Phase 4에서 사용)
        redisTemplate.opsForValue().set("concert:stock:1", "100");

        return ResponseEntity.ok().build();
    }
}
```

또는 SQL 스크립트로도 초기화할 수 있다.

```sql
-- scripts/reset.sql
TRUNCATE reservation RESTART IDENTITY CASCADE;
UPDATE concert SET stock = 100 WHERE id = 1;
```

### 체크리스트

- [ ] Grafana `localhost:3000` 접속 확인
- [ ] Prometheus `localhost:9090` 접속 확인
- [ ] Spring `/actuator/prometheus` 엔드포인트 응답 확인
- [ ] postgres-exporter 메트릭 수집 확인
- [ ] `/api/test/reset` 호출 시 DB 상태 초기화 확인

### 회고

- **예상과 달랐던 점**:
- **가장 어려웠던 부분**:
- **실무에 적용한다면**:

---

## Phase 2. 베이스라인 — 동시성 처리 없음

> "락 없이 구현하면 어떤 문제가 생기는가"를 수치로 확인한다.

### 2-1. 도메인 설계

```sql
-- 콘서트 예약 테이블
CREATE TABLE concert (
    id      BIGSERIAL PRIMARY KEY,
    title   VARCHAR(255) NOT NULL,
    stock   INT NOT NULL DEFAULT 100  -- 잔여 좌석
);

CREATE TABLE reservation (
    id         BIGSERIAL PRIMARY KEY,
    concert_id BIGINT NOT NULL REFERENCES concert(id),
    user_id    BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO concert (title, stock) VALUES ('콘서트 A', 100);
```

### 2-2. 락 없는 구현

```java
@Service
@RequiredArgsConstructor
public class ReservationService {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    @Transactional
    public void reserve(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
            .orElseThrow();

        if (concert.getStock() <= 0) {
            throw new IllegalStateException("잔여 좌석 없음");
        }

        // 여기서 레이스 컨디션 발생 — 동시 요청이 모두 stock > 0 확인 후 차감
        concert.setStock(concert.getStock() - 1);
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
```

### 2-3. TDD — 동시성 정합성 테스트

Testcontainers를 사용해 실제 PostgreSQL에서 동시성 문제를 테스트한다.

```java
@SpringBootTest
@Testcontainers
class ReservationConcurrencyTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("reservation")
        .withUsername("user")
        .withPassword("password");

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElseThrow();
        concert.setStock(100);
        concertRepository.save(concert);
    }

    @Test
    @DisplayName("락 없이 100명 동시 예약 시 overselling이 발생한다")
    void noLock_concurrency_causes_overselling() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    reservationService.reserve(1L, userId);
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();

        Concert concert = concertRepository.findById(1L).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(1L);

        // 락이 없으므로 재고와 예약 수가 불일치할 수 있다
        System.out.println("남은 재고: " + concert.getStock());
        System.out.println("예약 건수: " + reservationCount);
        System.out.println("정합성 오류: " + (reservationCount - (100 - concert.getStock())));

        // overselling 발생 여부 확인 (재고가 음수이거나 예약 수가 100 초과)
        assertThat(reservationCount).isGreaterThan(100 - concert.getStock());
    }
}
```

> **TDD 접근**: 먼저 "overselling이 발생한다"는 테스트를 작성하고, 이 테스트가 PASS하는 것을 확인한 뒤, Phase 3에서 해결한다. 각 Phase에서 동일한 동시성 테스트를 실행해 정합성이 보장되는지 검증한다.

### 2-4. k6 동시성 테스트 스크립트

#### 시나리오 1: 기본 동시 부하 (100 VU, 10초)

```javascript
// scripts/baseline.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    spike: {
      executor: "constant-vus",
      vus: 100, // 100명 동시 요청
      duration: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.post(
    "http://localhost:8080/api/reservations",
    JSON.stringify({ concertId: 1, userId: __VU }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(res, {
    "status 200": (r) => r.status === 200,
  });
}
```

#### 시나리오 2: 스파이크 — 순간 폭주

```javascript
// scripts/spike.js
export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 0 },
        { duration: "2s", target: 500 }, // 2초만에 500명 폭주
        { duration: "10s", target: 500 },
        { duration: "5s", target: 0 },
      ],
    },
  },
};
```

#### 시나리오 3: 점진적 증가 — 한계점 탐색 (Breaking Point)

```javascript
// scripts/ramp-up.js
export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 200 },
        { duration: "30s", target: 500 },
      ],
    },
  },
};

// → "몇 VU부터 에러율이 급등하는가?" 임계점(breaking point)을 찾는다
```

#### 시나리오 4: 지속 부하 — 안정성 검증

```javascript
// scripts/sustained.js
export const options = {
  scenarios: {
    sustained: {
      executor: "constant-vus",
      vus: 200,
      duration: "5m",
    },
  },
};

// → 장시간 부하에서도 커넥션 풀이 고갈되지 않는지 확인
```

### 2-5. 정합성 검증 쿼리

테스트 후 실제 데이터가 얼마나 깨졌는지 확인한다.

```sql
-- 예약 건수와 차감된 재고가 일치하는지 확인
SELECT
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1) AS reservation_count,
    (SELECT 100 - stock FROM concert WHERE id = 1)           AS stock_deducted,
    (SELECT COUNT(*) FROM reservation WHERE concert_id = 1)
        - (SELECT 100 - stock FROM concert WHERE id = 1)    AS inconsistency;
-- inconsistency > 0 이면 overselling 발생
```

### 여기서 얻는 인사이트

- 재고가 100개인데 100개 이상 팔리는 **overselling 현상** 수치 확인
- RPS는 높지만 **데이터 정합성이 깨지는 트레이드오프** 직접 경험
- "왜 동시성 처리가 필요한가"에 대한 가장 강력한 증거
- TDD 테스트로 **overselling이 발생한다는 사실을 자동화된 테스트로 증명**

### 회고

- **예상과 달랐던 점**:
- **가장 어려웠던 부분**:
- **실무에 적용한다면**:
- **핵심 수치 요약**: overselling 발생 건수 **_건, inconsistency 값 _**

---

## Phase 3. DB 락으로 동시성 처리

### 3-1. 비관적 락 (Pessimistic Lock)

충돌이 발생할 것이라고 **가정하고** 미리 락을 걸어 접근 자체를 차단한다.

```java
// Repository
public interface ConcertRepository extends JpaRepository<Concert, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)  // SELECT FOR UPDATE
    @Query("SELECT c FROM Concert c WHERE c.id = :id")
    Optional<Concert> findByIdWithLock(@Param("id") Long id);
}
```

```java
// Service
@Transactional
public void reserveWithPessimisticLock(Long concertId, Long userId) {
    // 락을 걸고 조회 — 다른 트랜잭션은 이 락이 풀릴 때까지 대기
    Concert concert = concertRepository.findByIdWithLock(concertId)
        .orElseThrow();

    if (concert.getStock() <= 0) {
        throw new IllegalStateException("잔여 좌석 없음");
    }

    concert.setStock(concert.getStock() - 1);
    reservationRepository.save(new Reservation(concertId, userId));
}
```

**예상 결과**

- 정합성: 100% 보장
- 처리량: Phase 2 대비 감소 (락 대기 시간만큼)
- DB 커넥션: 락 대기 트랜잭션이 커넥션을 점유 → 고갈 위험

### 3-2. 낙관적 락 (Optimistic Lock)

충돌이 드물 것이라고 **가정하고** 충돌 발생 시 재시도한다.

```java
// Entity
@Entity
public class Concert {
    @Id
    @GeneratedValue
    private Long id;

    private String title;
    private int stock;

    @Version  // 버전 컬럼으로 충돌 감지
    private Long version;
}
```

```java
// Service — 재시도 로직 포함
@Service
@RequiredArgsConstructor
public class ReservationService {

    @Retryable(
        value = OptimisticLockingFailureException.class,
        maxAttempts = 5,
        backoff = @Backoff(delay = 100)
    )
    @Transactional
    public void reserveWithOptimisticLock(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
            .orElseThrow();

        if (concert.getStock() <= 0) {
            throw new IllegalStateException("잔여 좌석 없음");
        }

        concert.setStock(concert.getStock() - 1);
        // 저장 시점에 version 불일치면 OptimisticLockingFailureException 발생
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
```

**예상 결과**

- 충돌률 낮을 때: 비관적 락보다 처리량 우수
- 충돌률 높을 때: 재시도 폭증 → 오히려 성능 악화
- 100 VU 동시 요청처럼 충돌이 잦은 상황에서는 비관적 락보다 불리

### 3-3. TDD — DB 락 정합성 테스트

```java
@Test
@DisplayName("비관적 락 적용 시 100명 동시 예약해도 정확히 100건만 예약된다")
void pessimisticLock_prevents_overselling() throws InterruptedException {
    int threadCount = 100;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger failCount = new AtomicInteger(0);

    for (int i = 0; i < threadCount; i++) {
        long userId = i + 1;
        executor.submit(() -> {
            try {
                reservationService.reserveWithPessimisticLock(1L, userId);
                successCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            } finally {
                latch.countDown();
            }
        });
    }
    latch.await();

    Concert concert = concertRepository.findById(1L).orElseThrow();

    assertThat(concert.getStock()).isGreaterThanOrEqualTo(0);        // 재고 음수 없음
    assertThat(successCount.get() + concert.getStock()).isEqualTo(100); // 정합성 보장
    System.out.println("성공: " + successCount.get() + ", 실패: " + failCount.get());
}

@Test
@DisplayName("낙관적 락 적용 시 재시도를 통해 정합성이 보장된다")
void optimisticLock_with_retry_prevents_overselling() throws InterruptedException {
    int threadCount = 100;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger failCount = new AtomicInteger(0);

    for (int i = 0; i < threadCount; i++) {
        long userId = i + 1;
        executor.submit(() -> {
            try {
                reservationService.reserveWithOptimisticLock(1L, userId);
                successCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            } finally {
                latch.countDown();
            }
        });
    }
    latch.await();

    Concert concert = concertRepository.findById(1L).orElseThrow();

    assertThat(concert.getStock()).isGreaterThanOrEqualTo(0);
    // 낙관적 락은 재시도 초과로 일부 실패할 수 있으므로 성공 + 남은재고 = 100
    assertThat(successCount.get() + concert.getStock()).isEqualTo(100);
    System.out.println("성공: " + successCount.get() + ", 실패(재시도 초과): " + failCount.get());
}
```

### 3-4. k6 테스트 스크립트 (Phase 2와 동일한 시나리오로 실행)

```javascript
// scripts/pessimistic-lock.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    spike: {
      executor: "constant-vus",
      vus: 100,
      duration: "10s",
    },
  },
};

export default function () {
  const res = http.post(
    "http://localhost:8080/api/reservations/pessimistic",
    JSON.stringify({ concertId: 1, userId: __VU }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "status 200": (r) => r.status === 200 });
}
```

### 3-5. Deadlock 시나리오 실험

비관적 락에서 의도적으로 **데드락(Deadlock)** 을 유발해보고, 감지 및 해결 과정을 경험한다.

```
시나리오:
- 유저 A: 콘서트 1 락 → 콘서트 2 락
- 유저 B: 콘서트 2 락 → 콘서트 1 락
→ 서로 상대방의 락을 기다리므로 Deadlock 발생!
```

```java
@Test
@DisplayName("멀티 리소스 비관적 락에서 데드락이 발생할 수 있다")
void pessimisticLock_deadlock_scenario() throws InterruptedException {
    // 콘서트 2개 준비
    concertRepository.save(new Concert("콘서트 B", 100));

    ExecutorService executor = Executors.newFixedThreadPool(2);
    CountDownLatch latch = new CountDownLatch(2);
    AtomicInteger deadlockCount = new AtomicInteger(0);

    // 유저 A: 콘서트 1 → 콘서트 2 순서로 락
    executor.submit(() -> {
        try {
            reservationService.reserveMultiple(1L, 2L, 1L);
        } catch (Exception e) {
            if (e.getMessage().contains("deadlock")) {
                deadlockCount.incrementAndGet();
            }
        } finally {
            latch.countDown();
        }
    });

    // 유저 B: 콘서트 2 → 콘서트 1 순서로 락 (역순)
    executor.submit(() -> {
        try {
            reservationService.reserveMultiple(2L, 1L, 2L);
        } catch (Exception e) {
            if (e.getMessage().contains("deadlock")) {
                deadlockCount.incrementAndGet();
            }
        } finally {
            latch.countDown();
        }
    });

    latch.await(10, TimeUnit.SECONDS);
    System.out.println("데드락 발생 횟수: " + deadlockCount.get());
}
```

PostgreSQL에서 데드락을 모니터링한다.

```sql
-- 현재 락 상태 확인
SELECT pid, locktype, relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;

-- 블로킹 쿼리 확인
SELECT blocked.pid AS blocked_pid,
       blocked.query AS blocked_query,
       blocking.pid AS blocking_pid,
       blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks bk ON bk.relation = bl.relation AND bk.granted
JOIN pg_stat_activity blocking ON blocking.pid = bk.pid
WHERE blocked.pid != blocking.pid;
```

### 3-6. Connection Pool Tuning 실험

HikariCP 커넥션 풀 크기를 변경하면서 비관적 락 성능 변화를 측정한다.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10 # → 20 → 30 → 50 으로 변경하며 측정
      connection-timeout: 30000
      minimum-idle: 5
```

| Pool Size | 비관적 락 RPS | p95 응답시간 | 커넥션 대기 시간 | 비고 |
| --------- | ------------- | ------------ | ---------------- | ---- |
| 10        |               |              |                  |      |
| 20        |               |              |                  |      |
| 30        |               |              |                  |      |
| 50        |               |              |                  |      |

> **핵심 질문**: "커넥션 풀을 키우면 성능이 계속 좋아지는가?"  
> Spoiler: 일정 수준 이상에서는 DB 측 Context Switching 비용으로 오히려 성능이 떨어진다.

### 여기서 얻는 인사이트

- 비관적 락: 정합성 100% 보장이지만 RPS가 Phase 2 대비 얼마나 떨어지는가
- 낙관적 락: 충돌률에 따라 성능이 급격히 달라지는 특성
- **DB 커넥션 풀 고갈** — Grafana에서 `hikaricp_connections_active` 지표로 직접 확인
- **데드락 발생 조건**과 PostgreSQL의 자동 감지 메커니즘 이해
- **커넥션 풀 크기 최적점** — "무조건 크게"가 아님을 수치로 증명
- "DB 락만으로 충분한가?"에 대한 수치적 한계 확인

### 회고

- **예상과 달랐던 점**:
- **가장 어려웠던 부분**:
- **실무에 적용한다면**:
- **핵심 수치 요약**: 비관적 락 RPS **_%, 커넥션 풀 최적 크기 _**, 데드락 발생 \_\_\_건

---

## Phase 4. Redis로 동시성 처리

### 4-1. Redis 분산락 — Redisson

DB 락 없이 Redis에서 락 처리. DB 부하를 분산시킨다.

> ⚠️ **주의: `@Transactional`과 분산락의 순서**  
> `lock.unlock()` 후 `@Transactional`이 커밋되기 전, 다른 스레드가 락을 획득하면 커밋되지 않은 데이터를 읽을 수 있다.  
> 따라서 **락 관리는 트랜잭션 바깥에서** 처리해야 한다.

```java
@Service
@RequiredArgsConstructor
public class ReservationService {

    private final RedissonClient redissonClient;
    private final ReservationInternalService internalService;

    // 락 관리는 트랜잭션 바깥에서
    public void reserveWithRedissonLock(Long concertId, Long userId)
            throws InterruptedException {

        RLock lock = redissonClient.getLock("concert:lock:" + concertId);

        boolean acquired = lock.tryLock(5, 3, TimeUnit.SECONDS);
        if (!acquired) {
            throw new IllegalStateException("락 획득 실패");
        }

        try {
            // 실제 비즈니스 로직은 별도 @Transactional 메서드에서 처리
            internalService.reserveInternal(concertId, userId);
        } finally {
            lock.unlock();
        }
    }
}

@Service
@RequiredArgsConstructor
public class ReservationInternalService {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    @Transactional
    public void reserveInternal(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
            .orElseThrow();

        if (concert.getStock() <= 0) {
            throw new IllegalStateException("잔여 좌석 없음");
        }

        concert.setStock(concert.getStock() - 1);
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
```

### 4-2. Redis 원자적 연산 — Lua 스크립트

락 없이 재고 조회와 차감을 원자적으로 처리한다.

```java
@Service
@RequiredArgsConstructor
public class ReservationService {

    private final StringRedisTemplate redisTemplate;
    private final ReservationRepository reservationRepository;

    private static final String STOCK_KEY = "concert:stock:";
    private static final String LUA_SCRIPT = """
        local stock = tonumber(redis.call('GET', KEYS[1]))
        if stock == nil or stock <= 0 then
            return -1
        end
        redis.call('DECR', KEYS[1])
        return stock - 1
        """;

    public void reserveWithLuaScript(Long concertId, Long userId) {
        Long result = redisTemplate.execute(
            new DefaultRedisScript<>(LUA_SCRIPT, Long.class),
            List.of(STOCK_KEY + concertId)
        );

        if (result == null || result < 0) {
            throw new IllegalStateException("잔여 좌석 없음");
        }

        // DB에는 예약 기록만 저장 (락 없이)
        try {
            reservationRepository.save(new Reservation(concertId, userId));
        } catch (Exception e) {
            // 보상 트랜잭션: Redis 재고 복구
            redisTemplate.opsForValue().increment(STOCK_KEY + concertId);
            throw e;
        }
    }

    // 초기 재고를 Redis에 세팅
    public void initStock(Long concertId, int stock) {
        redisTemplate.opsForValue().set(STOCK_KEY + concertId, String.valueOf(stock));
    }
}
```

> ⚠️ **Redis ↔ DB 데이터 불일치 주의**  
> Redis에서 차감 성공 → DB 저장 실패 시, Redis 재고는 줄었는데 예약은 없는 상태가 된다.  
> 위 코드처럼 **보상 트랜잭션(Compensation)** 패턴을 적용해 Redis 재고를 복구한다.  
> 실무에서는 이 외에도 Outbox 패턴, 이벤트 소싱 등 Eventually Consistent 전략을 검토할 수 있다.

### 4-3. TDD — Redis 동시성 정합성 테스트

```java
@SpringBootTest
@Testcontainers
class RedisReservationConcurrencyTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7.2-alpine")
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElseThrow();
        concert.setStock(100);
        concertRepository.save(concert);
        reservationService.initStock(1L, 100);
    }

    @Test
    @DisplayName("Redis 분산락으로 100명 동시 예약 시 정합성이 보장된다")
    void redissonLock_prevents_overselling() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    reservationService.reserveWithRedissonLock(1L, userId);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();

        Concert concert = concertRepository.findById(1L).orElseThrow();
        assertThat(concert.getStock()).isGreaterThanOrEqualTo(0);
        assertThat(successCount.get() + concert.getStock()).isEqualTo(100);
    }

    @Test
    @DisplayName("Redis Lua 스크립트로 100명 동시 예약 시 정합성이 보장된다")
    void luaScript_prevents_overselling() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    reservationService.reserveWithLuaScript(1L, userId);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();

        long reservationCount = reservationRepository.countByConcertId(1L);
        assertThat(reservationCount).isEqualTo(successCount.get());
        assertThat(reservationCount).isLessThanOrEqualTo(100);
    }

    @Test
    @DisplayName("Redis Lua에서 DB 저장 실패 시 보상 트랜잭션이 재고를 복구한다")
    void luaScript_compensation_on_db_failure() {
        // DB 저장이 실패하도록 유도 (예: 잘못된 concert_id)
        assertThatThrownBy(() ->
            reservationService.reserveWithLuaScript(999L, 1L)
        ).isInstanceOf(Exception.class);

        // Redis 재고가 복구되었는지 확인
        String stock = redisTemplate.opsForValue().get("concert:stock:999");
        // 보상 트랜잭션이 정상 동작하면 재고가 원래대로
    }
}
```

### 4-4. Redis 모니터링 추가

```yaml
# docker-compose.app.yml에 추가
redis-exporter:
  image: oliver006/redis_exporter
  ports:
    - "9121:9121"
  environment:
    REDIS_ADDR: "redis:6379"
  depends_on:
    - redis
```

```yaml
# prometheus.yml에 추가
- job_name: "redis"
  static_configs:
    - targets: ["redis-exporter:9121"]
```

### 여기서 얻는 인사이트

- DB 락 대비 **RPS 개선 수치** — "Redis가 얼마나 빠른가" 직접 측정
- DB 커넥션 풀 고갈 문제가 해소되는 것 Grafana에서 시각적으로 확인
- Redis 장애 시 fallback 없으면 전체 서비스 장애 발생 — 단일 장애점(SPOF) 인지
- **`@Transactional`과 분산락 순서** — 틀리면 정합성 깨지는 실전 함정
- **Redis ↔ DB 불일치 시 보상 트랜잭션**의 필요성과 한계

### 회고

- **예상과 달랐던 점**:
- **가장 어려웠던 부분**:
- **실무에 적용한다면**:
- **핵심 수치 요약**: Redis 분산락 RPS ***배 향상, Lua RPS ***배 향상

---

## Phase 5. 비교 분석 및 인사이트 정리

### 5-1. 최종 비교표 (직접 측정한 수치로 채우기)

| 방식         | RPS | p50 | p95 | p99 | max | 에러율 | 정합성 | 재시도 횟수 | DB 커넥션 | 스레드 사용률 |
| ------------ | --- | --- | --- | --- | --- | ------ | ------ | ----------- | --------- | ------------- |
| 락 없음      |     |     |     |     |     |        | ❌     | -           |           |               |
| 비관적 락    |     |     |     |     |     |        | ✅     | -           |           |               |
| 낙관적 락    |     |     |     |     |     |        | ✅     |             |           |               |
| Redis 분산락 |     |     |     |     |     |        | ✅     | -           |           |               |
| Redis Lua    |     |     |     |     |     |        | ✅     | -           |           |               |

> **측정 시 유의사항**: 각 방식별로 동일한 환경(VU 수, duration)에서 최소 3회 반복 측정해 평균값을 기록한다.

### 5-2. 수치화 핵심 항목

| #   | 수치화할 항목                   | 기대 예시                                     |
| --- | ------------------------------- | --------------------------------------------- |
| 1   | Overselling 발생 건수 (Phase 2) | "100석 기준 37건 초과 판매 발생"              |
| 2   | 비관적 락 RPS 감소율            | "락 없음 대비 RPS 73% 감소"                   |
| 3   | 낙관적 락 재시도 횟수           | "1000 요청 중 평균 4.2회 재시도"              |
| 4   | Redis 분산락 RPS 향상율         | "비관적 락 대비 3.4배 처리량 향상"            |
| 5   | Redis Lua RPS vs 분산락         | "분산락 대비 1.8배 추가 향상"                 |
| 6   | DB 커넥션 풀 최대 사용률        | "비관적 락 시 커넥션 풀 100% 점유 (10/10)"    |
| 7   | 방식별 p99 응답시간 차이        | "비관적 락 p99: 2300ms → Redis Lua p99: 45ms" |
| 8   | 커넥션 풀 크기별 성능 곡선      | "Pool 30에서 최적, 50부터 성능 역전"          |
| 9   | 데드락 발생 빈도                | "멀티 리소스 락 시 1000건 중 12건 데드락"     |
| 10  | 임계 VU 수 (Breaking Point)     | "비관적 락은 150 VU부터 에러율 급등"          |

### 5-3. Grafana 대시보드 구성

한 화면에서 모든 방식을 비교하기 위해 아래 패널을 구성한다.

```
Row 1: 처리량 비교
  - k6 RPS (방식별 annotation 구분)
  - http_req_duration p50 / p95 / p99

Row 2: 안정성 비교
  - http_req_failed rate
  - DB 에러율
  - 낙관적 락 재시도 횟수

Row 3: 인프라 영향도
  - hikaricp_connections_active (DB 커넥션 풀)
  - hikaricp_connections_pending (커넥션 대기 수)
  - redis_connected_clients (Redis 연결 수)
  - redis_commands_duration_seconds (Redis 명령 지연)
  - PostgreSQL 슬로우 쿼리 발생 횟수

Row 4: JVM 상태
  - jvm_threads_states (Tomcat 스레드 풀 사용률)
  - jvm_gc_pause_seconds (GC pause time)
```

테스트 실행 시 annotation을 추가해 방식 전환 시점을 표시한다.

```bash
# Grafana annotation 추가 (방식 전환 시점 표시)
curl -X POST http://admin:admin@localhost:3000/api/annotations \
  -H "Content-Type: application/json" \
  -d '{"text":"비관적 락 테스트 시작","tags":["test"]}'
```

### 5-4. 방식별 선택 기준 정리

직접 측정한 수치를 바탕으로 아래 기준을 본인의 언어로 정리한다.

**비관적 락을 선택하는 경우**

- 충돌이 매우 빈번하게 발생하는 도메인
- 정합성이 성능보다 절대적으로 중요한 경우
- Redis 같은 외부 인프라를 추가하기 어려운 상황

**낙관적 락을 선택하는 경우**

- 충돌이 드문 도메인 (읽기가 쓰기보다 압도적으로 많은 경우)
- 재시도 비용이 낮은 경우

**Redis 분산락을 선택하는 경우**

- 높은 처리량이 필요한 경우
- 여러 서버 인스턴스에서 동시성 보장이 필요한 경우 (MSA)
- DB 커넥션 풀 고갈이 우려되는 경우

**Redis 원자적 연산을 선택하는 경우**

- 재고 차감처럼 단순한 카운터 연산인 경우
- 락 오버헤드 없이 최고 성능이 필요한 경우

---

## 최종 학습 성과

이 로드맵을 완료하면 다음 질문에 수치로 답할 수 있게 된다.

> "DB만으로도 동시성 처리가 되지 않나?"
> → 됩니다. 하지만 측정 결과 RPS가 **N% 감소**하고 커넥션 풀이 **N개 고갈**되었습니다.

> "Redis가 얼마나 좋아지는데?"
> → 비관적 락 대비 RPS **N배 향상**, p95 응답시간 **Nms → Nms** 개선되었습니다.

> "어떤 상황에서 뭘 써야 해?"
> → 충돌률 N% 이상이면 비관적 락, 이하면 낙관적 락, 트래픽이 N RPS 이상이면 Redis가 적합합니다.

> "커넥션 풀은 크면 클수록 좋은 거 아니야?"
> → Pool Size N까지는 성능이 향상되지만, 이후부터는 Context Switching 비용으로 오히려 **N% 성능 저하**가 발생했습니다.

> "데드락은 어떻게 찾아?"
> → PostgreSQL의 `pg_locks` 뷰와 `deadlock_timeout` 설정으로 감지하며, 실험에서 **N건 중 N건** 발생했습니다.

> "테스트 코드로 동시성을 검증할 수 있어?"
> → Testcontainers + CountDownLatch 패턴으로 **100 스레드 동시 실행 테스트**를 작성해 정합성을 자동 검증했습니다.
