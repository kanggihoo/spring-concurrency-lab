# 002. Phase 2 Consistency API

### Task 002: Add Final Consistency Snapshot Endpoint

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/controller/TestController.java`
- Create: `concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java`

- [ ] **Step 1: Write the endpoint contract test**

Create `concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java`:

```java
package com.example.concurrency.controller;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class TestControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElseGet(() -> concertRepository.save(new Concert("Concert A", 100)));
        concert.resetRemainingSeats(12);
        concertRepository.save(concert);
        reservationRepository.save(new Reservation(1L, 1L));
        reservationRepository.save(new Reservation(1L, 2L));
    }

    @Test
    void consistency_returns_phase2_snapshot_for_concert_one() throws Exception {
        mockMvc.perform(get("/api/test/consistency"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concertId", is(1)))
                .andExpect(jsonPath("$.initialSeatCount", is(100)))
                .andExpect(jsonPath("$.reservationCount", is(2)))
                .andExpect(jsonPath("$.remainingSeats", is(12)))
                .andExpect(jsonPath("$.seatCountInconsistency", is(-86)))
                .andExpect(jsonPath("$.overbooked", is(false)));
    }
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
cd concurrency
./gradlew test --tests com.example.concurrency.controller.TestControllerTest
```

Expected: FAIL because `GET /api/test/consistency` is not implemented.

- [ ] **Step 3: Add the consistency endpoint**

Modify `concurrency/src/main/java/com/example/concurrency/controller/TestController.java`.

Add imports:

```java
import java.util.LinkedHashMap;
```

Add constants inside the class:

```java
private static final long PHASE2_CONCERT_ID = 1L;
private static final int PHASE2_INITIAL_SEAT_COUNT = 100;
```

Add this endpoint below `reset()`:

```java
@GetMapping("/consistency")
@Transactional(readOnly = true)
public ResponseEntity<Map<String, Object>> consistency() {
    Concert concert = concertRepository.findById(PHASE2_CONCERT_ID)
            .orElseThrow(() -> new IllegalStateException("Concert not found. id=" + PHASE2_CONCERT_ID));
    long reservationCount = reservationRepository.countByConcertId(PHASE2_CONCERT_ID);
    int remainingSeats = concert.getRemainingSeats();
    long seatCountInconsistency = reservationCount + remainingSeats - PHASE2_INITIAL_SEAT_COUNT;
    boolean overbooked = reservationCount > PHASE2_INITIAL_SEAT_COUNT;

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("concertId", PHASE2_CONCERT_ID);
    body.put("initialSeatCount", PHASE2_INITIAL_SEAT_COUNT);
    body.put("reservationCount", reservationCount);
    body.put("remainingSeats", remainingSeats);
    body.put("seatCountInconsistency", seatCountInconsistency);
    body.put("overbooked", overbooked);

    return ResponseEntity.ok(body);
}
```

- [ ] **Step 4: Run the endpoint test and verify it passes**

Run:

```bash
cd concurrency
./gradlew test --tests com.example.concurrency.controller.TestControllerTest
```

Expected: PASS.

- [ ] **Step 5: Run existing concurrency test**

Run:

```bash
cd concurrency
./gradlew test --tests com.example.concurrency.ReservationConcurrencyTest
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add concurrency/src/main/java/com/example/concurrency/controller/TestController.java concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java
git commit -m "feat: expose phase2 consistency snapshot"
```
