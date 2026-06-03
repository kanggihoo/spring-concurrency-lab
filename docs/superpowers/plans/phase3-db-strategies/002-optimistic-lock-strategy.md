# 002. Optimistic Lock Strategy

### Task 002: Implement JPA Optimistic Lock With Retry

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- Modify: `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`

- [ ] **Step 1: Add optimistic lock tests**

Append these tests to `DbStrategiesConcurrencyTest`:

```java
@Test
@DisplayName("Optimistic Lock: concurrent reservations preserve counted-seat invariant")
void optimisticLock_concurrentReservations_preserveInvariant() throws InterruptedException {
    StrategyResult result = runConcurrentReservations(userId ->
            reservationService.reserveWithOptimisticLock(CONCERT_ID, userId));

    Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
    long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);

    assertThat(result.successCount()).isBetween(1, INITIAL_SEAT_COUNT);
    assertThat(reservationCount).isEqualTo(result.successCount());
    assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(reservationCount).isLessThanOrEqualTo(INITIAL_SEAT_COUNT);
}

@Test
@DisplayName("Optimistic Lock: sold-out request does not create Reservation")
void optimisticLock_soldOut_doesNotCreateReservation() {
    Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
    concert.resetRemainingSeats(0);
    concertRepository.saveAndFlush(concert);

    assertThatThrownBy(() -> reservationService.reserveWithOptimisticLock(CONCERT_ID, 1L))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("Sold out");

    assertThat(reservationRepository.countByConcertId(CONCERT_ID)).isZero();
}
```

- [ ] **Step 2: Run optimistic tests and verify they fail**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: FAIL because `reserveWithOptimisticLock` does not exist.

- [ ] **Step 3: Add TransactionTemplate and retry metrics**

Modify `ReservationService`.

Add imports:

```java
import jakarta.persistence.OptimisticLockException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
```

Add fields:

```java
private static final int MAX_OPTIMISTIC_ATTEMPTS = 5;

private final TransactionTemplate transactionTemplate;
private final Counter optimisticRetryCounter;
```

Change the constructor to:

```java
public ReservationService(ConcertRepository concertRepository,
                          ReservationRepository reservationRepository,
                          PlatformTransactionManager transactionManager,
                          MeterRegistry meterRegistry) {
    this.concertRepository = concertRepository;
    this.reservationRepository = reservationRepository;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.optimisticRetryCounter = Counter.builder("reservation.optimistic.retry")
            .description("Optimistic lock retry attempts")
            .register(meterRegistry);
}
```

- [ ] **Step 4: Implement optimistic lock method**

Add these methods inside `ReservationService`:

```java
public void reserveWithOptimisticLock(Long concertId, Long userId) {
    int attempts = 0;

    while (attempts < MAX_OPTIMISTIC_ATTEMPTS) {
        try {
            transactionTemplate.executeWithoutResult(status ->
                    reserveWithOptimisticLockOnce(concertId, userId));
            return;
        } catch (ObjectOptimisticLockingFailureException | OptimisticLockException e) {
            attempts++;
            optimisticRetryCounter.increment();
            if (attempts >= MAX_OPTIMISTIC_ATTEMPTS) {
                throw new OptimisticLockRetryExhaustedException(attempts);
            }
        }
    }
}

private void reserveWithOptimisticLockOnce(Long concertId, Long userId) {
    Concert concert = concertRepository.findById(concertId)
            .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

    concert.reserveOneSeat();
    reservationRepository.save(new Reservation(concertId, userId));
}
```

- [ ] **Step 5: Add the optimistic endpoint**

Modify `ReservationController`.

Add import:

```java
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
```

Keep the existing `com.example.concurrency.domain.SoldOutException` import from Task 001.

Add this endpoint below the pessimistic endpoint:

```java
@PostMapping("/optimistic")
public ResponseEntity<Map<String, String>> reserveWithOptimisticLock(@RequestBody ReservationRequest request) {
    try {
        reservationService.reserveWithOptimisticLock(request.concertId(), request.userId());
        return ResponseEntity.ok(Map.of("status", "reserved"));
    } catch (SoldOutException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
    } catch (OptimisticLockRetryExhaustedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "optimistic_lock_exhausted"));
    }
}
```

- [ ] **Step 6: Run tests and verify pass**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: PASS for pessimistic and optimistic strategy tests.

- [ ] **Step 7: Commit**

```powershell
git add concurrency/src/main/java/com/example/concurrency/service/ReservationService.java `
        concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java `
        concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java
git commit -m "feat: add optimistic reservation strategy"
```
