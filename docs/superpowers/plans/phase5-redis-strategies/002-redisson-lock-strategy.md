# 002. Redisson Lock Strategy

### Task 002: Implement Redisson Lock Reservation Path

**Files:**
- Create: `concurrency/src/main/java/com/example/concurrency/service/RedisLockAcquireFailedException.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- Create: `concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java`

- [ ] **Step 1: Add lock acquire failure exception**

Create `concurrency/src/main/java/com/example/concurrency/service/RedisLockAcquireFailedException.java`:

```java
package com.example.concurrency.service;

public class RedisLockAcquireFailedException extends RuntimeException {

    public RedisLockAcquireFailedException(Long concertId) {
        super("Redis lock acquire failed. concertId=" + concertId);
    }
}
```

- [ ] **Step 2: Add Redisson collaborators to ReservationService**

Modify `ReservationService` imports:

```java
import com.example.concurrency.redis.RedisSeatKey;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Value;
import java.util.concurrent.TimeUnit;
```

Add fields:

```java
private final RedissonClient redissonClient;
private final Counter redisLockAcquireFailureCounter;
private final long redisLockWaitMs;
private final long redisLockLeaseMs;
```

Extend constructor parameters:

```java
RedissonClient redissonClient,
@Value("${reservation.redis.lock-wait-ms:200}") long redisLockWaitMs,
@Value("${reservation.redis.lock-lease-ms:3000}") long redisLockLeaseMs
```

Initialize fields:

```java
this.redissonClient = redissonClient;
this.redisLockWaitMs = redisLockWaitMs;
this.redisLockLeaseMs = redisLockLeaseMs;
this.redisLockAcquireFailureCounter = Counter.builder("reservation.redis.lock.acquire.failed")
        .description("Redis lock acquire failures")
        .register(meterRegistry);
```

- [ ] **Step 3: Add Redisson reservation method**

Add this method to `ReservationService`:

```java
public void reserveWithRedissonLock(Long concertId, Long userId) {
    RLock lock = redissonClient.getLock(RedisSeatKey.lock(concertId));
    boolean acquired = false;
    try {
        acquired = lock.tryLock(redisLockWaitMs, redisLockLeaseMs, TimeUnit.MILLISECONDS);
        if (!acquired) {
            redisLockAcquireFailureCounter.increment();
            throw new RedisLockAcquireFailedException(concertId);
        }

        transactionTemplate.executeWithoutResult(status ->
                reserveWithPessimisticLockFreeDbWrite(concertId, userId));
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        redisLockAcquireFailureCounter.increment();
        throw new RedisLockAcquireFailedException(concertId);
    } finally {
        if (acquired && lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}

private void reserveWithPessimisticLockFreeDbWrite(Long concertId, Long userId) {
    int updatedRows = concertRepository.decreaseRemainingSeatsIfAvailable(concertId);
    if (updatedRows == 0) {
        throw new SoldOutException();
    }
    reservationRepository.save(new Reservation(concertId, userId));
}
```

- [ ] **Step 4: Add Redisson controller endpoint**

In `ReservationController`, add import:

```java
import com.example.concurrency.service.RedisLockAcquireFailedException;
```

Add endpoint:

```java
@PostMapping("/redisson")
public ResponseEntity<Map<String, String>> reserveWithRedissonLock(@RequestBody ReservationRequest request) {
    try {
        reservationService.reserveWithRedissonLock(request.concertId(), request.userId());
        return ResponseEntity.ok(Map.of("status", "reserved"));
    } catch (SoldOutException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
    } catch (RedisLockAcquireFailedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "lock_acquire_failed"));
    }
}
```

- [ ] **Step 5: Write Redisson concurrent correctness test**

Create `concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java`:

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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class RedisStrategiesConcurrencyTest {

    private static final long CONCERT_ID = 1L;
    private static final int INITIAL_SEAT_COUNT = 100;

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7.2-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("reservation.redis.lock-wait-ms", () -> "300");
        registry.add("reservation.redis.lock-lease-ms", () -> "3000");
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
        Concert concert = concertRepository.findById(CONCERT_ID)
                .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
        concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
        concertRepository.saveAndFlush(concert);
    }

    @Test
    @DisplayName("Redisson Lock: concurrent reservations preserve counted-seat invariant")
    void redissonLock_concurrentReservations_preserveInvariant() throws InterruptedException {
        StrategyResult result = runConcurrentReservations(userId ->
                reservationService.reserveWithRedissonLock(CONCERT_ID, userId));

        Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);

        assertThat(result.successCount()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount).isLessThanOrEqualTo(INITIAL_SEAT_COUNT);
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

- [ ] **Step 6: Run Redisson test**

Run:

```bash
rtk gradlew -p concurrency test --tests com.example.concurrency.RedisStrategiesConcurrencyTest.redissonLock_concurrentReservations_preserveInvariant
```

Expected: test passes.

- [ ] **Step 7: Commit**

```bash
git add concurrency/src/main/java/com/example/concurrency/service/RedisLockAcquireFailedException.java \
        concurrency/src/main/java/com/example/concurrency/service/ReservationService.java \
        concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java \
        concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java
git commit -m "feat: add redisson reservation strategy"
```
