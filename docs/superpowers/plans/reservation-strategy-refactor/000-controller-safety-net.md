# Reservation Strategy Refactor Implementation Plan - 000 Controller Safety Net

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컨트롤러 호환 endpoint와 새 generic strategy endpoint의 기대 동작을 먼저 테스트로 고정한다.

**Architecture:** MockMvc 통합 테스트를 추가해 `/api/reservations`, `/api/reservations/atomic`, `/api/reservations/not-real`의 응답 계약을 검증한다. 이 단계에서는 production code를 바꾸지 않으므로 generic endpoint 테스트는 실패해야 한다.

**Tech Stack:** Spring Boot Test, MockMvc, Testcontainers PostgreSQL, JUnit 5.

---

## Task 000: Controller Safety Net

**Files:**

- Create: `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`

- [ ] **Step 1: 컨트롤러 테스트 파일을 추가한다**

Create `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`:

```java
package com.example.concurrency.controller;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ReservationControllerTest {

    private static final long CONCERT_ID = 1L;
    private static final int INITIAL_SEAT_COUNT = 100;

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine")
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
        Concert concert = concertRepository.findById(CONCERT_ID)
                .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
        concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
        concertRepository.saveAndFlush(concert);
    }

    @Test
    @DisplayName("기존 기본 예약 endpoint는 no-lock 전략으로 성공 응답을 반환한다")
    void reserveDefault_usesNoLockStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("기존 atomic endpoint 경로는 계속 성공 응답을 반환한다")
    void reserveAtomic_compatibilityPathStillWorks() throws Exception {
        mockMvc.perform(post("/api/reservations/atomic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("새 generic endpoint는 no-lock 전략 이름으로 예약을 실행한다")
    void reserveGeneric_noLockStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations/no-lock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":3}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("알 수 없는 전략은 unknown_strategy 응답을 반환한다")
    void reserveGeneric_unknownStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations/not-real")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":4}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is("unknown_strategy")));
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.controller.ReservationControllerTest
```

Expected:

```text
reserveDefault_usesNoLockStrategy PASSED
reserveAtomic_compatibilityPathStillWorks PASSED
reserveGeneric_noLockStrategy FAILED
reserveGeneric_unknownStrategy FAILED
```

실패 이유는 아직 `POST /api/reservations/{strategy}` generic mapping과 `unknown_strategy` 응답 계약이 없기 때문이다.

- [ ] **Step 3: 커밋한다**

```bash
git add concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java
git commit -m "test: add reservation controller strategy safety net"
```
