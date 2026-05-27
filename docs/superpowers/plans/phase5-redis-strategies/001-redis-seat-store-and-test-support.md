# 001. Redis Seat Store and Test Support

### Task 001: Add Redis Remaining Seats Store and Test API Support

**Files:**
- Create: `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatKey.java`
- Create: `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/TestController.java`
- Modify: `concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java`

- [ ] **Step 1: Create Redis key helper**

Create `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatKey.java`:

```java
package com.example.concurrency.redis;

public final class RedisSeatKey {

    private RedisSeatKey() {
    }

    public static String remainingSeats(Long concertId) {
        return "concert:%d:remaining-seats".formatted(concertId);
    }

    public static String lock(Long concertId) {
        return "concert:%d:reservation-lock".formatted(concertId);
    }
}
```

- [ ] **Step 2: Create Redis seat store**

Create `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java`:

```java
package com.example.concurrency.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisSeatStore {

    private final StringRedisTemplate redisTemplate;

    public RedisSeatStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void initializeRemainingSeats(Long concertId, int remainingSeats) {
        redisTemplate.opsForValue().set(RedisSeatKey.remainingSeats(concertId), Integer.toString(remainingSeats));
    }

    public Integer getRemainingSeats(Long concertId) {
        String value = redisTemplate.opsForValue().get(RedisSeatKey.remainingSeats(concertId));
        if (value == null) {
            return null;
        }
        return Integer.parseInt(value);
    }

    public void compensateDecrement(Long concertId) {
        redisTemplate.opsForValue().increment(RedisSeatKey.remainingSeats(concertId));
    }
}
```

- [ ] **Step 3: Wire Redis reset and snapshot into TestController**

Modify `TestController` constructor and fields:

```java
private final RedisSeatStore redisSeatStore;

public TestController(ConcertRepository concertRepository,
                      ReservationRepository reservationRepository,
                      RedisSeatStore redisSeatStore) {
    this.concertRepository = concertRepository;
    this.reservationRepository = reservationRepository;
    this.redisSeatStore = redisSeatStore;
}
```

Add import:

```java
import com.example.concurrency.redis.RedisSeatStore;
```

In `reset()`, after `concertRepository.save(concert);`, add:

```java
redisSeatStore.initializeRemainingSeats(PHASE2_CONCERT_ID, PHASE2_INITIAL_SEAT_COUNT);
```

In `consistency()`, add Redis snapshot to the response body:

```java
body.put("redisRemainingSeats", redisSeatStore.getRemainingSeats(PHASE2_CONCERT_ID));
```

- [ ] **Step 4: Update controller test expectation**

Modify `concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java` so `consistency()` test expects `redisRemainingSeats`.

Add a mock:

```java
@MockBean
private RedisSeatStore redisSeatStore;
```

Add import:

```java
import com.example.concurrency.redis.RedisSeatStore;
```

In the consistency test setup, add:

```java
given(redisSeatStore.getRemainingSeats(1L)).willReturn(12);
```

Add expectation:

```java
.andExpect(jsonPath("$.redisRemainingSeats", is(12)))
```

- [ ] **Step 5: Run controller tests**

Run:

```bash
rtk gradlew -p concurrency test --tests com.example.concurrency.controller.TestControllerTest
```

Expected: `TestControllerTest` passes.

- [ ] **Step 6: Commit**

```bash
git add concurrency/src/main/java/com/example/concurrency/redis/RedisSeatKey.java \
        concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java \
        concurrency/src/main/java/com/example/concurrency/controller/TestController.java \
        concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java
git commit -m "feat: add redis seat store test support"
```
