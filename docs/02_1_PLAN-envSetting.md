# Phase 2 구현 계획: 베이스라인 — 동시성 처리 없음

## Context

콘서트 예약 시스템에서 "락 없이 구현하면 어떤 문제가 생기는가"를 수치로 확인하는 단계.
TDD 방식으로 테스트를 먼저 작성하고, 구현 후 overselling이 발생함을 증명한 뒤, k6로 실제 부하를 측정한다.

---

## 구현 순서 (TDD: 테스트 → 구현 → 검증)

### Step 1. `build.gradle` 의존성 수정

**파일**: `concurrency/build.gradle`

- **제거**: `testImplementation 'org.springframework.boot:spring-boot-starter-session-data-redis-test'` (Redis 미사용, Testcontainer 기동 실패 원인)
- **확인**: Spring Boot 4.0.3의 `spring-boot-starter-data-jpa-test`가 Testcontainers PostgreSQL을 포함하는지 확인
  - 포함하지 않을 경우 수동 추가: `testImplementation 'org.testcontainers:junit-jupiter'` + `testImplementation 'org.testcontainers:postgresql'`

### Step 2. 동시성 테스트 작성 (RED — 컴파일 안 됨)

**파일**: `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`

- `@SpringBootTest` + `@Testcontainers`
- `@Container` + `@ServiceConnection`으로 PostgreSQL 17-alpine 컨테이너 자동 관리
  - `@ServiceConnection` 미지원 시 `@DynamicPropertySource`로 폴백
- 테스트: "락 없이 100명 동시 예약 시 overselling이 발생한다"
  - `ExecutorService` + `CountDownLatch` (100 threads)
  - 핵심 assertion: `reservationCount + concert.getStock() != 100` (정합성 불일치)
- `@BeforeEach`: 데이터 초기화 (concert 없으면 생성, stock=100 리셋)

### Step 3. Entity 생성

**`concurrency/src/main/java/com/example/concurrency/domain/Concert.java`**

- `@Entity`, `@Table(name = "concert")`
- 필드: `id` (Long, IDENTITY), `title` (String), `stock` (int)
- Lombok: `@Getter`, `@NoArgsConstructor(access = PROTECTED)`
- `@Version` 없음 (Phase 3에서 추가)

**`concurrency/src/main/java/com/example/concurrency/domain/Reservation.java`**

- `@Entity`, `@Table(name = "reservation")`
- 필드: `id` (Long, IDENTITY), `concertId` (Long, 단순 FK 값), `userId` (Long), `createdAt` (LocalDateTime)

### Step 4. Repository 생성

**`concurrency/src/main/java/com/example/concurrency/repository/ConcertRepository.java`**

- `JpaRepository<Concert, Long>` 상속

**`concurrency/src/main/java/com/example/concurrency/repository/ReservationRepository.java`**

- `JpaRepository<Reservation, Long>` 상속
- `long countByConcertId(Long concertId)` 메서드

### Step 5. Service 생성 (락 없음 — 의도적 Race Condition)

**`concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`**

- `@Transactional reserve(Long concertId, Long userId)`
- 로직: findById → stock 체크 → stock 차감 → reservation 저장
- Race condition 발생 지점: 여러 스레드가 동시에 같은 stock 값을 읽고 차감

### Step 6. 테스트 실행 (GREEN — overselling 증명)

- 테스트 PASS = overselling 발생 확인 = Phase 2의 목적 달성

### Step 7. Controller 생성

**`concurrency/src/main/java/com/example/concurrency/controller/ReservationRequest.java`**

- Java record: `ReservationRequest(Long concertId, Long userId)`

**`concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`**

- `POST /api/reservations` → 200 (성공) / 409 (좌석 없음)

### Step 8. TestController에 Reset 엔드포인트 추가

**`concurrency/src/main/java/com/example/concurrency/controller/TestController.java`** (기존 파일 수정)

- `POST /api/test/reset` 추가
- reservation 전체 삭제 + concert stock=100 리셋

### Step 9. DB 스키마 + Docker Compose 업데이트

**`postgres/init/02_schema.sql`** (신규)

```sql
CREATE TABLE IF NOT EXISTS concert (
    id      BIGSERIAL PRIMARY KEY,
    title   VARCHAR(255) NOT NULL,
    stock   INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS reservation (
    id         BIGSERIAL PRIMARY KEY,
    concert_id BIGINT NOT NULL REFERENCES concert(id),
    user_id    BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO concert (title, stock) VALUES ('콘서트 A', 100);
```

**`docker-compose.yml`** — postgres volumes에 추가:

```yaml
- ./postgres/init/02_schema.sql:/docker-entrypoint-initdb.d/02_schema.sql
```

> ⚠️ 기존 볼륨이 있으면 `docker compose down -v && docker compose up -d` 필요

### Step 10. k6 부하 테스트

- `baseline.js`는 이미 `POST /api/reservations`을 호출하도록 작성됨
- `setup()` 함수에 `/api/test/reset` 호출 추가 (반복 테스트용)

---

## 생성/수정 파일 목록

| 순서 | 파일                                                             | 작업                      |
| ---- | ---------------------------------------------------------------- | ------------------------- |
| 1    | `concurrency/build.gradle`                                       | 수정 (redis-test 제거)    |
| 2    | `concurrency/src/test/.../ReservationConcurrencyTest.java`       | 신규                      |
| 3    | `concurrency/src/main/.../domain/Concert.java`                   | 신규                      |
| 4    | `concurrency/src/main/.../domain/Reservation.java`               | 신규                      |
| 5    | `concurrency/src/main/.../repository/ConcertRepository.java`     | 신규                      |
| 6    | `concurrency/src/main/.../repository/ReservationRepository.java` | 신규                      |
| 7    | `concurrency/src/main/.../service/ReservationService.java`       | 신규                      |
| 8    | `concurrency/src/main/.../controller/ReservationRequest.java`    | 신규                      |
| 9    | `concurrency/src/main/.../controller/ReservationController.java` | 신규                      |
| 10   | `concurrency/src/main/.../controller/TestController.java`        | 수정 (reset 추가)         |
| 11   | `postgres/init/02_schema.sql`                                    | 신규                      |
| 12   | `docker-compose.yml`                                             | 수정 (volume 추가)        |
| 13   | `scripts/baseline.js`                                            | 수정 (setup에 reset 추가) |

---

## 검증 방법

1. **테스트 실행**: `cd concurrency && ./gradlew test` → `ReservationConcurrencyTest` PASS (overselling 발생 증명)
2. **앱 실행**: Spring Boot 기동 후 `POST /api/test/reset` 호출 → 200 OK
3. **k6 부하**: `docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/baseline.js` → Grafana에서 결과 확인
4. **정합성 쿼리**: `SELECT COUNT(*) FROM reservation WHERE concert_id = 1` vs `SELECT 100 - stock FROM concert WHERE id = 1` → 불일치 확인
