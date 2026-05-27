# 003. Redis Lua Atomic Decrement

### Task 003: Implement Redis Lua Gate, DB Sync, and Compensation

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/RedisReservationException.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- Modify: `concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java`
- Create: `concurrency/src/test/java/com/example/concurrency/RedisLuaCompensationTest.java`

- [ ] **Step 1: Add Lua atomic decrement to RedisSeatStore**

Modify `RedisSeatStore`:

```java
private static final String DECREMENT_IF_AVAILABLE_SCRIPT = """
        local seats = tonumber(redis.call('GET', KEYS[1]))
        if seats == nil or seats <= 0 then
            return 0
        end
        redis.call('DECR', KEYS[1])
        return 1
        """;
```

Add imports:

```java
import org.springframework.data.redis.core.script.DefaultRedisScript;
import java.util.List;
```

Add method:

```java
public boolean decrementIfAvailable(Long concertId) {
    DefaultRedisScript<Long> script = new DefaultRedisScript<>(DECREMENT_IF_AVAILABLE_SCRIPT, Long.class);
    Long result = redisTemplate.execute(script, List.of(RedisSeatKey.remainingSeats(concertId)));
    return result != null && result == 1L;
}
```

- [ ] **Step 2: Add Redis reservation exception**

Create `concurrency/src/main/java/com/example/concurrency/service/RedisReservationException.java`:

```java
package com.example.concurrency.service;

public class RedisReservationException extends RuntimeException {

    public RedisReservationException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 3: Extract DB reservation writer seam**

Create `concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java`:

```java
package com.example.concurrency.service;

import com.example.concurrency.domain.Reservation;
import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DbReservationWriter {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public DbReservationWriter(ConcertRepository concertRepository,
                               ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional
    public void reserveWithAtomicUpdate(Long concertId, Long userId) {
        int updatedRows = concertRepository.decreaseRemainingSeatsIfAvailable(concertId);
        if (updatedRows == 0) {
            throw new SoldOutException();
        }
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
```

- [ ] **Step 4: Add Redis Lua collaborators to ReservationService**

Add import:

```java
import com.example.concurrency.redis.RedisSeatStore;
```

Add field:

```java
private final RedisSeatStore redisSeatStore;
private final DbReservationWriter dbReservationWriter;
private final Counter redisCompensationCounter;
```

Add constructor parameter:

```java
RedisSeatStore redisSeatStore,
DbReservationWriter dbReservationWriter,
```

Initialize:

```java
this.redisSeatStore = redisSeatStore;
this.dbReservationWriter = dbReservationWriter;
this.redisCompensationCounter = Counter.builder("reservation.redis.compensation")
        .description("Redis decrement compensations after DB failures")
        .register(meterRegistry);
```

- [ ] **Step 5: Route DB atomic writes through DbReservationWriter**

Replace the body of `reserveWithAtomicUpdate`:

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

with:

```java
public void reserveWithAtomicUpdate(Long concertId, Long userId) {
    dbReservationWriter.reserveWithAtomicUpdate(concertId, userId);
}
```

In `reserveWithRedissonLock`, replace:

```java
transactionTemplate.executeWithoutResult(status ->
        reserveWithPessimisticLockFreeDbWrite(concertId, userId));
```

with:

```java
dbReservationWriter.reserveWithAtomicUpdate(concertId, userId);
```

Delete the private `reserveWithPessimisticLockFreeDbWrite` method after both call sites are removed.

- [ ] **Step 6: Add Redis Lua reservation method**

Add method to `ReservationService`:

```java
public void reserveWithRedisLua(Long concertId, Long userId) {
    boolean decremented = redisSeatStore.decrementIfAvailable(concertId);
    if (!decremented) {
        throw new SoldOutException();
    }

    try {
        dbReservationWriter.reserveWithAtomicUpdate(concertId, userId);
    } catch (RuntimeException e) {
        redisSeatStore.compensateDecrement(concertId);
        redisCompensationCounter.increment();
        throw new RedisReservationException("DB reservation failed after Redis decrement. concertId=" + concertId, e);
    }
}
```

This method uses `DbReservationWriter` so DB `remaining_seats` and Reservation stay synchronized.

- [ ] **Step 7: Add Lua controller endpoint**

In `ReservationController`, add import:

```java
import com.example.concurrency.service.RedisReservationException;
```

Add endpoint:

```java
@PostMapping("/redis-lua")
public ResponseEntity<Map<String, String>> reserveWithRedisLua(@RequestBody ReservationRequest request) {
    try {
        reservationService.reserveWithRedisLua(request.concertId(), request.userId());
        return ResponseEntity.ok(Map.of("status", "reserved"));
    } catch (SoldOutException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
    } catch (RedisReservationException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "redis_db_sync_failed"));
    }
}
```

- [ ] **Step 8: Add Redis Lua concurrent correctness test**

Add to `RedisStrategiesConcurrencyTest`:

```java
@Autowired
private RedisSeatStore redisSeatStore;

@BeforeEach
void setUp() {
    reservationRepository.deleteAll();
    Concert concert = concertRepository.findById(CONCERT_ID)
            .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
    concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
    concertRepository.saveAndFlush(concert);
    redisSeatStore.initializeRemainingSeats(CONCERT_ID, INITIAL_SEAT_COUNT);
}

@Test
@DisplayName("Redis Lua: concurrent reservations preserve counted-seat invariant")
void redisLua_concurrentReservations_preserveInvariant() throws InterruptedException {
    StrategyResult result = runConcurrentReservations(userId ->
            reservationService.reserveWithRedisLua(CONCERT_ID, userId));

    Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
    long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);
    Integer redisRemainingSeats = redisSeatStore.getRemainingSeats(CONCERT_ID);

    assertThat(result.successCount()).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(reservationCount).isEqualTo(INITIAL_SEAT_COUNT);
    assertThat(concert.getRemainingSeats()).isZero();
    assertThat(redisRemainingSeats).isZero();
    assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
}
```

Add import:

```java
import com.example.concurrency.redis.RedisSeatStore;
```

- [ ] **Step 9: Add compensation test with mocked DB failure**

Create `concurrency/src/test/java/com/example/concurrency/RedisLuaCompensationTest.java`:

```java
package com.example.concurrency;

import com.example.concurrency.redis.RedisSeatStore;
import com.example.concurrency.service.DbReservationWriter;
import com.example.concurrency.service.RedisReservationException;
import com.example.concurrency.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;

@SpringBootTest
@Testcontainers
class RedisLuaCompensationTest {

    private static final long CONCERT_ID = 1L;

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7.2-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private RedisSeatStore redisSeatStore;

    @MockBean
    private DbReservationWriter dbReservationWriter;

    @BeforeEach
    void setUp() {
        redisSeatStore.initializeRemainingSeats(CONCERT_ID, 1);
    }

    @Test
    @DisplayName("Redis Lua: DB failure after decrement compensates Redis Remaining Seats")
    void redisLua_dbFailureAfterDecrement_compensatesRedisRemainingSeats() {
        doThrow(new RuntimeException("forced DB failure"))
                .when(dbReservationWriter)
                .reserveWithAtomicUpdate(eq(CONCERT_ID), eq(1L));

        assertThatThrownBy(() -> reservationService.reserveWithRedisLua(CONCERT_ID, 1L))
                .isInstanceOf(RedisReservationException.class);

        assertThat(redisSeatStore.getRemainingSeats(CONCERT_ID)).isEqualTo(1);
    }
}
```

- [ ] **Step 10: Run Redis strategy tests**

Run:

```bash
rtk gradlew -p concurrency test --tests com.example.concurrency.RedisStrategiesConcurrencyTest --tests com.example.concurrency.RedisLuaCompensationTest
```

Expected: both Redis strategy tests pass.

- [ ] **Step 11: Commit**

```bash
git add concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java \
        concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java \
        concurrency/src/main/java/com/example/concurrency/service/RedisReservationException.java \
        concurrency/src/main/java/com/example/concurrency/service/ReservationService.java \
        concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java \
        concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java \
        concurrency/src/test/java/com/example/concurrency/RedisLuaCompensationTest.java
git commit -m "feat: add redis lua reservation strategy"
```
