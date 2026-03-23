# Phase 3 구현 계획 — DB 락으로 동시성 처리

> Phase 2에서 증명한 overselling 문제를 비관적 락(Pessimistic Lock)과 낙관적 락(Optimistic Lock)으로 해결한다.
> TDD 방식: 테스트 먼저 작성 → 실패 확인 → 구현 → 통과 확인

---

## 현재 상태 (Phase 2 완료)

### 코드 구조

```
concurrency/src/main/java/com/example/concurrency/
├── controller/
│   ├── ReservationController.java    # POST /api/reservations
│   ├── ReservationRequest.java       # record DTO {concertId, userId}
│   └── TestController.java           # GET /api/test, POST /api/test/reset
├── domain/
│   ├── Concert.java                  # id, title, stock — @Version 없음
│   └── Reservation.java             # id, concertId, userId, createdAt
├── repository/
│   ├── ConcertRepository.java        # 기본 JpaRepository만
│   └── ReservationRepository.java    # countByConcertId()
└── service/
    └── ReservationService.java       # reserve() — 락 없는 베이스라인
```

### 핵심 문제

- `Concert.java`에 `@Version` 없음 → JPA가 동시성 제어를 하지 않음
- `ConcertRepository`에 `SELECT FOR UPDATE` 쿼리 없음
- `ReservationService.reserve()`에서 Lost Update 발생 (100명 동시 예약 → 재고 9~13만 차감)

---

## 구현 순서 (TDD)

### Step 1. 의존성 추가

**파일**: `concurrency/build.gradle`

```gradle
// 추가할 의존성
implementation 'org.springframework.retry:spring-retry'  // 낙관적 락 재시도용
implementation 'org.springframework:spring-aspects'       // @Retryable AOP 지원
```

> `@Retryable`은 낙관적 락에서 `OptimisticLockingFailureException` 발생 시 자동 재시도를 위해 필요하다.

---

### Step 2. Entity 수정

**파일**: `concurrency/src/main/java/.../domain/Concert.java`

변경 내용:

- `@Version` 필드 추가 (낙관적 락용)
- `decreaseStock()`에 재고 0 이하 방어 로직 추가

```java
@Entity
public class Concert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private int stock;

    @Version                    // ← 추가: 낙관적 락용 버전 컬럼
    private Long version;

    public void decreaseStock() {
        if (this.stock <= 0) {
            throw new IllegalStateException("Sold out.");
        }
        this.stock--;
    }
}
```

**DB 스키마 변경**: `02_schema.sql`에 `version` 컬럼 추가

```sql
CREATE TABLE IF NOT EXISTS concert (
    id      BIGSERIAL PRIMARY KEY,
    title   VARCHAR(255) NOT NULL,
    stock   INT NOT NULL DEFAULT 100,
    version BIGINT NOT NULL DEFAULT 0    -- 추가
);
```

---

### Step 3. Repository 수정

**파일**: `concurrency/src/main/java/.../repository/ConcertRepository.java`

비관적 락 전용 조회 메서드 추가:

```java
public interface ConcertRepository extends JpaRepository<Concert, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Concert c WHERE c.id = :id")
    Optional<Concert> findByIdWithPessimisticLock(@Param("id") Long id);
}
```

> `@Lock(PESSIMISTIC_WRITE)` → SQL: `SELECT ... FROM concert WHERE id = ? FOR UPDATE`
> 해당 row에 대해 배타적 락을 걸어 다른 트랜잭션의 읽기/쓰기를 차단한다.

---

### Step 4. Service 수정

**파일**: `concurrency/src/main/java/.../service/ReservationService.java`

기존 `reserve()` 유지 + 2개 메서드 추가:

```java
@Service
public class ReservationService {

    // 기존 — 락 없음 (Phase 2 베이스라인)
    @Transactional
    public void reserve(Long concertId, Long userId) { ... }

    // 추가 1 — 비관적 락
    @Transactional
    public void reserveWithPessimisticLock(Long concertId, Long userId) {
        Concert concert = concertRepository.findByIdWithPessimisticLock(concertId)
                .orElseThrow();
        concert.decreaseStock();
        reservationRepository.save(new Reservation(concertId, userId));
    }

    // 추가 2 — 낙관적 락 (재시도 포함)
    @Retryable(
        retryFor = OptimisticLockingFailureException.class,
        maxAttempts = 5,
        backoff = @Backoff(delay = 100)
    )
    @Transactional
    public void reserveWithOptimisticLock(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow();
        concert.decreaseStock();
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
```

**`@EnableRetry` 설정 추가**: `ConcurrencyApplication.java`

```java
@SpringBootApplication
@EnableRetry    // ← 추가
public class ConcurrencyApplication { ... }
```

---

### Step 5. Controller 수정

**파일**: `concurrency/src/main/java/.../controller/ReservationController.java`

새 엔드포인트 2개 추가:

```
POST /api/reservations              → 락 없음 (기존)
POST /api/reservations/pessimistic  → 비관적 락 (추가)
POST /api/reservations/optimistic   → 낙관적 락 (추가)
```

---

### Step 6. TestController 수정

**파일**: `concurrency/src/main/java/.../controller/TestController.java`

`POST /api/test/reset`에서 `version` 필드도 초기화:

- `@Version` 추가 후 reset 시 version도 리셋해야 테스트 반복 가능

---

### Step 7. 테스트 코드 작성 (TDD 핵심)

테스트 파일을 **락 방식별로 분리**하여 구성한다.

#### 7-1. 비관적 락 테스트

**파일**: `concurrency/src/test/.../PessimisticLockTest.java`

```
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
class PessimisticLockTest {

    // Testcontainers PostgreSQL 공유

    // --- API 단위 테스트 ---
    ① 비관적 락 예약 성공 → 200 OK
    ② 재고 소진 시 → 409 CONFLICT
    ③ 존재하지 않는 콘서트 → 400 또는 404

    // --- Service 동시성 테스트 ---
    ④ 100 threads → reserveWithPessimisticLock() 직접 호출
      → assertThat(successCount + concert.getStock()).isEqualTo(100)  // 정합성 보장
      → assertThat(concert.getStock()).isGreaterThanOrEqualTo(0)      // 재고 음수 없음

    // --- API 동시성 테스트 ---
    ⑤ 100 threads → POST /api/reservations/pessimistic
      → 동일한 정합성 검증 (k6와 같은 경로)
}
```

#### 7-2. 낙관적 락 테스트

**파일**: `concurrency/src/test/.../OptimisticLockTest.java`

```
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
class OptimisticLockTest {

    // --- API 단위 테스트 ---
    ① 낙관적 락 예약 성공 → 200 OK
    ② 재고 소진 시 → 409 CONFLICT

    // --- Service 동시성 테스트 ---
    ③ 100 threads → reserveWithOptimisticLock() 직접 호출
      → assertThat(successCount + concert.getStock()).isEqualTo(100)  // 재시도로 정합성 보장
      → 재시도 초과 실패 건수 출력

    // --- API 동시성 테스트 ---
    ④ 100 threads → POST /api/reservations/optimistic
      → 동일한 정합성 검증
}
```

#### 테스트에서 검증할 핵심 항목

| 항목                  | 비관적 락                   | 낙관적 락                   |
| --------------------- | --------------------------- | --------------------------- |
| 재고 음수 방지        | `stock >= 0`                | `stock >= 0`                |
| 정합성                | `성공 수 + 남은 재고 = 100` | `성공 수 + 남은 재고 = 100` |
| 재고 0 이후 예약 차단 | 추가 예약 불가              | 추가 예약 불가              |
| API 응답 코드         | 성공 200, 매진 409          | 성공 200, 매진 409          |

---

### Step 8. k6 부하 테스트 스크립트

**파일**: `scripts/pessimistic-lock.js`

```javascript
// 비관적 락 엔드포인트로 100 VU, 10초 부하
// POST /api/reservations/pessimistic
```

**파일**: `scripts/optimistic-lock.js`

```javascript
// 낙관적 락 엔드포인트로 100 VU, 10초 부하
// POST /api/reservations/optimistic
```

> Phase 2의 baseline.js와 동일한 조건(100 VU, 10초)으로 실행해야 비교가 의미 있다.

---

### Step 9. (선택) 데드락 시나리오 실험

**파일**: `concurrency/src/test/.../DeadlockTest.java`

- 콘서트 2개에 대해 역순으로 비관적 락 → 데드락 유발
- PostgreSQL의 데드락 감지(`deadlock_timeout`) 동작 확인
- `reserveMultiple()` 메서드 추가 필요

---

### Step 10. (선택) HikariCP 커넥션 풀 튜닝 실험

**파일**: `application.yml`

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10 # → 20 → 30 → 50 변경하며 측정
```

---

## 구현 순서 요약

| 순서 | 작업                                 | 파일                          | 유형          |
| ---- | ------------------------------------ | ----------------------------- | ------------- |
| 1    | spring-retry 의존성 추가             | `build.gradle`                | 설정          |
| 2    | `@Version` 필드 추가                 | `Concert.java`                | Entity        |
| 3    | `version` 컬럼 추가                  | `02_schema.sql`               | DB 스키마     |
| 4    | 비관적 락 조회 메서드 추가           | `ConcertRepository.java`      | Repository    |
| 5    | 비관적/낙관적 락 예약 메서드 추가    | `ReservationService.java`     | Service       |
| 6    | `@EnableRetry` 추가                  | `ConcurrencyApplication.java` | 설정          |
| 7    | 비관적/낙관적 API 엔드포인트 추가    | `ReservationController.java`  | Controller    |
| 8    | reset에서 version 초기화             | `TestController.java`         | Controller    |
| 9    | 비관적 락 테스트 (API 단위 + 동시성) | `PessimisticLockTest.java`    | 테스트 (신규) |
| 10   | 낙관적 락 테스트 (API 단위 + 동시성) | `OptimisticLockTest.java`     | 테스트 (신규) |
| 11   | k6 비관적 락 스크립트                | `scripts/pessimistic-lock.js` | k6            |
| 12   | k6 낙관적 락 스크립트                | `scripts/optimistic-lock.js`  | k6            |
| 13   | (선택) 데드락 테스트                 | `DeadlockTest.java`           | 테스트 (신규) |
| 14   | (선택) 커넥션 풀 튜닝                | `application.yml`             | 설정          |

---

## TDD 진행 흐름

```
[비관적 락]
1. PessimisticLockTest 작성 (컴파일 에러 — 메서드가 없으므로)
2. ConcertRepository에 findByIdWithPessimisticLock() 추가
3. ReservationService에 reserveWithPessimisticLock() 추가
4. ReservationController에 /pessimistic 엔드포인트 추가
5. 테스트 실행 → 전체 통과 확인

[낙관적 락]
6. OptimisticLockTest 작성 (컴파일 에러)
7. Concert에 @Version 추가
8. ReservationService에 reserveWithOptimisticLock() + @Retryable 추가
9. ReservationController에 /optimistic 엔드포인트 추가
10. 테스트 실행 → 전체 통과 확인

[k6 부하 테스트]
11. pessimistic-lock.js 작성
12. optimistic-lock.js 작성
13. Spring Boot 로컬 실행 + k6로 부하 테스트
14. Grafana에서 결과 확인 및 Phase 2 수치와 비교
```

---

## 비교 측정 항목 (Phase 2 vs Phase 3)

| 항목              | Phase 2 (락 없음) | 비관적 락      | 낙관적 락           |
| ----------------- | ----------------- | -------------- | ------------------- |
| RPS (초당 처리량) | 높음              | 감소 예상      | 충돌률에 따라 변동  |
| p95 응답시간      | 낮음              | 증가 (락 대기) | 증가 (재시도)       |
| 에러율            | 낮음              | 낮음           | 재시도 초과 시 증가 |
| 정합성            | **깨짐** ❌       | **보장** ✅    | **보장** ✅         |
| DB 커넥션 사용    | 낮음              | 높음 (락 대기) | 보통                |
