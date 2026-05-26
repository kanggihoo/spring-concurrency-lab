# 003. Atomic Conditional Update Strategy

### Task 003: Implement Atomic Conditional Update Reservation Path

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- Modify: `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`

- [ ] **Step 1: Add atomic update tests**

Append these tests to `DbStrategiesConcurrencyTest`:

```java
@Test
@DisplayName("Atomic Conditional Update: concurrent reservations preserve counted-seat invariant")
void atomicUpdate_concurrentReservations_preserveInvariant() throws InterruptedException {
    StrategyResult result = runConcurrentReservations(userId ->
            reservationService.reserveWithAtomicUpdate(CONCERT_ID, userId));

    Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
    long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);

    assertThat(result.successCount()).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(result.failureCount()).isZero();
    assertThat(reservationCount).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(reservationCount).isLessThanOrEqualTo(INITIAL_SEAT_COUNT);
}

@Test
@DisplayName("Atomic Conditional Update: sold-out request does not create Reservation")
void atomicUpdate_soldOut_doesNotCreateReservation() {
    Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
    concert.resetRemainingSeats(0);
    concertRepository.saveAndFlush(concert);

    assertThatThrownBy(() -> reservationService.reserveWithAtomicUpdate(CONCERT_ID, 1L))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("Sold out");

    assertThat(reservationRepository.countByConcertId(CONCERT_ID)).isZero();
}
```

- [ ] **Step 2: Run atomic tests and verify they fail**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: FAIL because `reserveWithAtomicUpdate` does not exist.

- [ ] **Step 3: Implement atomic update service method**

Add this method inside `ReservationService`:

```java
@Transactional
public void reserveWithAtomicUpdate(Long concertId, Long userId) {
    int updatedRows = concertRepository.decreaseRemainingSeatsIfAvailable(concertId);
    if (updatedRows == 0) {
        throw new SoldOutException();
    }

    reservationRepository.save(new Reservation(concertId, userId));
}
```

- [ ] **Step 4: Add the atomic endpoint**

Add this endpoint inside `ReservationController`:

```java
@PostMapping("/atomic")
public ResponseEntity<Map<String, String>> reserveWithAtomicUpdate(@RequestBody ReservationRequest request) {
    try {
        reservationService.reserveWithAtomicUpdate(request.concertId(), request.userId());
        return ResponseEntity.ok(Map.of("status", "reserved"));
    } catch (SoldOutException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
    }
}
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.DbStrategiesConcurrencyTest
```

Expected: PASS for pessimistic, optimistic, and atomic strategy tests.

- [ ] **Step 6: Commit**

```powershell
git add concurrency/src/main/java/com/example/concurrency/service/ReservationService.java `
        concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java `
        concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java
git commit -m "feat: add atomic reservation strategy"
```

