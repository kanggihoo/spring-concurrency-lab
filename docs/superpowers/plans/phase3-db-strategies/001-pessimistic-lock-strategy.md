# 001. Pessimistic Lock Strategy

### Task 001: Implement Pessimistic Lock Reservation Path

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- Create: `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`

- [ ] **Step 1: Write pessimistic lock tests**

Create `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`:

```java
package com.example.concurrency;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class DbStrategiesConcurrencyTest {

    private static final long CONCERT_ID = 1L;
    private static final int INITIAL_SEAT_COUNT = 100;

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(CONCERT_ID)
                .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
        concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
        concertRepository.saveAndFlush(concert);
    }

    @Test
    @DisplayName("Pessimistic Lock: concurrent reservations preserve counted-seat invariant")
    void pessimisticLock_concurrentReservations_preserveInvariant() throws InterruptedException {
        StrategyResult result = runConcurrentReservations(userId ->
                reservationService.reserveWithPessimisticLock(CONCERT_ID, userId));

        Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);

        assertThat(result.successCount()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(result.failureCount()).isZero();
        assertThat(reservationCount).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount).isLessThanOrEqualTo(INITIAL_SEAT_COUNT);
    }

    @Test
    @DisplayName("Pessimistic Lock: sold-out request does not create Reservation")
    void pessimisticLock_soldOut_doesNotCreateReservation() {
        Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
        concert.resetRemainingSeats(0);
        concertRepository.saveAndFlush(concert);

        assertThatThrownBy(() -> reservationService.reserveWithPessimisticLock(CONCERT_ID, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Sold out");

        assertThat(reservationRepository.countByConcertId(CONCERT_ID)).isZero();
    }

    private StrategyResult runConcurrentReservations(ReservationCommand command) throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger failureCount = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1L;
            executor.submit(() -> {
                try {
                    command.reserve(userId);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                    failureCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();
        return new StrategyResult(successCount.get(), failureCount.get());
    }

    @FunctionalInterface
    private interface ReservationCommand {
        void reserve(long userId);
    }

    private record StrategyResult(int successCount, int failureCount) {
    }
}
```

- [ ] **Step 2: Run the new pessimistic test and verify it fails**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: FAIL because `reserveWithPessimisticLock` does not exist.

- [ ] **Step 3: Implement the service method**

Modify `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`.

Add this method inside `ReservationService`:

```java
@Transactional
public void reserveWithPessimisticLock(Long concertId, Long userId) {
    Concert concert = concertRepository.findByIdWithPessimisticLock(concertId)
            .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

    concert.reserveOneSeat();
    reservationRepository.save(new Reservation(concertId, userId));
}
```

- [ ] **Step 4: Add the pessimistic endpoint**

Modify `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`.

Add imports:

```java
import com.example.concurrency.domain.SoldOutException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
```

Add this endpoint below the existing `reserve()` method:

```java
@PostMapping("/pessimistic")
public ResponseEntity<Map<String, String>> reserveWithPessimisticLock(@RequestBody ReservationRequest request) {
    try {
        reservationService.reserveWithPessimisticLock(request.concertId(), request.userId());
        return ResponseEntity.ok(Map.of("status", "reserved"));
    } catch (SoldOutException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
    } catch (PessimisticLockingFailureException | QueryTimeoutException e) {
        return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(Map.of("status", "lock_timeout"));
    }
}
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: PASS for pessimistic tests.

- [ ] **Step 6: Commit**

```powershell
git add concurrency/src/main/java/com/example/concurrency/service/ReservationService.java `
        concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java `
        concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java
git commit -m "feat: add pessimistic reservation strategy"
```
