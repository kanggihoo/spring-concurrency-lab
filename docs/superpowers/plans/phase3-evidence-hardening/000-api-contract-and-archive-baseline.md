# 000. API 계약 고정과 기존 Evidence 분리 확인

### Task 000: Phase 3 응답 계약 테스트와 archive 상태 확인

**Files:**
- Create: `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`
- Read: `docs/evidence/03-db-strategies/archive/20260527-original/**`
- Read: `docs/evidence/03-db-strategies/{pessimistic-lock,optimistic-lock,atomic-update}/**`

- [ ] **Step 1: 기존 evidence가 archive로 분리되었는지 확인한다**

Run:

```bash
rtk find docs/evidence/03-db-strategies -maxdepth 3 -type f | rtk sort
```

Expected:

```text
docs/evidence/03-db-strategies/archive/20260527-original/... 기존 파일들이 존재한다
docs/evidence/03-db-strategies/pessimistic-lock/... 새 측정 파일은 아직 없거나 .gitkeep만 존재한다
docs/evidence/03-db-strategies/optimistic-lock/... 새 측정 파일은 아직 없거나 .gitkeep만 존재한다
docs/evidence/03-db-strategies/atomic-update/... 새 측정 파일은 아직 없거나 .gitkeep만 존재한다
```

- [ ] **Step 2: Phase 3 API 계약 테스트 파일을 생성한다**

`concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`를 아래 내용으로 생성한다.

```java
package com.example.concurrency.controller;

import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReservationControllerTest {

    private ReservationService reservationService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new ReservationController(reservationService))
                .build();
    }

    @Test
    @DisplayName("비관적 락 예약 성공은 200 reserved를 반환한다")
    void pessimistic_reserved_returns_ok() throws Exception {
        mockMvc.perform(post("/api/reservations/pessimistic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("비관적 락 sold out은 409 sold_out을 반환한다")
    void pessimistic_sold_out_returns_conflict() throws Exception {
        doThrow(new SoldOutException())
                .when(reservationService)
                .reserveWithPessimisticLock(1L, 42L);

        mockMvc.perform(post("/api/reservations/pessimistic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is("sold_out")));
    }

    @Test
    @DisplayName("비관적 락 timeout 분기는 408 lock_timeout을 반환한다")
    void pessimistic_timeout_branch_returns_request_timeout() throws Exception {
        doThrow(new PessimisticLockingFailureException("lock timeout"))
                .when(reservationService)
                .reserveWithPessimisticLock(1L, 42L);

        mockMvc.perform(post("/api/reservations/pessimistic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isRequestTimeout())
                .andExpect(jsonPath("$.status", is("lock_timeout")));
    }

    @Test
    @DisplayName("낙관적 락 retry exhaustion은 409 optimistic_lock_exhausted를 반환한다")
    void optimistic_retry_exhausted_returns_conflict() throws Exception {
        doThrow(new OptimisticLockRetryExhaustedException(5))
                .when(reservationService)
                .reserveWithOptimisticLock(1L, 42L);

        mockMvc.perform(post("/api/reservations/optimistic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is("optimistic_lock_exhausted")));
    }

    @Test
    @DisplayName("Atomic sold out은 409 sold_out을 반환한다")
    void atomic_sold_out_returns_conflict() throws Exception {
        doThrow(new SoldOutException())
                .when(reservationService)
                .reserveWithAtomicUpdate(1L, 42L);

        mockMvc.perform(post("/api/reservations/atomic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is("sold_out")));
    }

    private static String requestBody() {
        return """
                {
                  "concertId": 1,
                  "userId": 42
                }
                """;
    }
}
```

- [ ] **Step 3: 새 controller 테스트만 실행한다**

Run:

```bash
rtk sh -lc 'cd concurrency && ./gradlew test --tests com.example.concurrency.controller.ReservationControllerTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 4: 전체 테스트 회귀를 확인한다**

Run:

```bash
rtk sh -lc 'cd concurrency && ./gradlew test'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java docs/evidence/03-db-strategies
rtk git commit -m "test: lock phase3 reservation response contract"
```

Expected:

```text
[... test: lock phase3 reservation response contract]
```
