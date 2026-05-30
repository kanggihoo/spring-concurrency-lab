# Reservation Strategy Refactor Implementation Plan - 005 Test Migration and Service Removal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 테스트가 `ReservationService` 대신 `ReservationUseCase`를 사용하게 바꾸고, 중앙 집중형 `ReservationService`를 제거한다.

**Architecture:** 테스트는 실제 production entry point인 `ReservationUseCase.reserve(strategy, command)`를 호출한다. 이렇게 해야 Phase 5 이후 새 전략이 같은 방식으로 검증된다.

**Tech Stack:** Spring Boot Test, Testcontainers, JUnit 5, AssertJ.

---

## Task 005: Test Migration and Service Removal

**Files:**

- Modify: `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`
- Modify: `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`
- Delete: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`

- [ ] **Step 1: DbStrategiesConcurrencyTest의 service 의존성을 use case로 바꾼다**

In `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`, replace:

```java
import com.example.concurrency.service.ReservationService;
```

with:

```java
import com.example.concurrency.service.ReservationCommand;
import com.example.concurrency.service.ReservationUseCase;
```

Replace:

```java
@Autowired
private ReservationService reservationService;
```

with:

```java
@Autowired
private ReservationUseCase reservationUseCase;
```

Replace strategy calls:

```java
reservationService.reserveWithPessimisticLock(CONCERT_ID, userId)
reservationService.reserveWithOptimisticLock(CONCERT_ID, userId)
reservationService.reserveWithAtomicUpdate(CONCERT_ID, userId)
```

with:

```java
reservationUseCase.reserve("pessimistic", new ReservationCommand(CONCERT_ID, userId))
reservationUseCase.reserve("optimistic", new ReservationCommand(CONCERT_ID, userId))
reservationUseCase.reserve("atomic", new ReservationCommand(CONCERT_ID, userId))
```

Sold-out assertions should use the same mapping:

```java
assertThatThrownBy(() -> reservationUseCase.reserve("pessimistic", new ReservationCommand(CONCERT_ID, 1L)))
        .isInstanceOf(RuntimeException.class)
        .hasMessageContaining("Sold out");

assertThatThrownBy(() -> reservationUseCase.reserve("optimistic", new ReservationCommand(CONCERT_ID, 1L)))
        .isInstanceOf(RuntimeException.class)
        .hasMessageContaining("Sold out");

assertThatThrownBy(() -> reservationUseCase.reserve("atomic", new ReservationCommand(CONCERT_ID, 1L)))
        .isInstanceOf(RuntimeException.class)
        .hasMessageContaining("Sold out");
```

- [ ] **Step 2: ReservationConcurrencyTest의 disabled no-lock 호출을 use case로 바꾼다**

In `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`, replace:

```java
import com.example.concurrency.service.ReservationService;
```

with:

```java
import com.example.concurrency.service.ReservationCommand;
import com.example.concurrency.service.ReservationUseCase;
```

Replace:

```java
@Autowired
private ReservationService reservationService;
```

with:

```java
@Autowired
private ReservationUseCase reservationUseCase;
```

Replace:

```java
reservationService.reserve(1L, userId);
```

with:

```java
reservationUseCase.reserve("no-lock", new ReservationCommand(1L, userId));
```

- [ ] **Step 3: ReservationService를 삭제한다**

Delete:

```text
concurrency/src/main/java/com/example/concurrency/service/ReservationService.java
```

- [ ] **Step 4: ReservationService 참조가 남아 있지 않은지 확인한다**

Run:

```bash
rg "ReservationService" concurrency/src
```

Expected:

```text
no matches
```

- [ ] **Step 5: DB 전략 테스트가 통과하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: 커밋한다**

```bash
git add \
  concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java \
  concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java
git rm concurrency/src/main/java/com/example/concurrency/service/ReservationService.java
git commit -m "refactor: remove reservation service facade"
```
