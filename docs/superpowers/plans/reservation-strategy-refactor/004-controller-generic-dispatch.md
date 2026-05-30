# Reservation Strategy Refactor Implementation Plan - 004 Controller Generic Dispatch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ReservationController`가 기존 경로 호환성을 유지하면서 generic strategy endpoint로 전략을 실행하게 한다.

**Architecture:** 컨트롤러는 `ReservationUseCase`만 의존한다. `/api/reservations`는 `no-lock` 전략을 호출하고, `/api/reservations/{strategy}`는 path variable을 그대로 전략 이름으로 사용한다.

**Tech Stack:** Spring MVC, MockMvc, Java 21.

---

## Task 004: Controller Generic Dispatch

**Files:**

- Modify: `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`

- [ ] **Step 1: ReservationController를 use case 기반으로 교체한다**

Replace `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java` with:

```java
package com.example.concurrency.controller;

import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.ReservationCommand;
import com.example.concurrency.service.ReservationUseCase;
import com.example.concurrency.service.UnknownReservationStrategyException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationUseCase reservationUseCase;

    public ReservationController(ReservationUseCase reservationUseCase) {
        this.reservationUseCase = reservationUseCase;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> reserveDefault(@RequestBody ReservationRequest request) {
        return reserveWithStrategy("no-lock", request);
    }

    @PostMapping("/{strategy}")
    public ResponseEntity<Map<String, String>> reserveByStrategy(@PathVariable String strategy,
                                                                 @RequestBody ReservationRequest request) {
        return reserveWithStrategy(strategy, request);
    }

    private ResponseEntity<Map<String, String>> reserveWithStrategy(String strategy,
                                                                    ReservationRequest request) {
        try {
            reservationUseCase.reserve(strategy, new ReservationCommand(request.concertId(), request.userId()));
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (OptimisticLockRetryExhaustedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "optimistic_lock_exhausted"));
        } catch (PessimisticLockingFailureException | QueryTimeoutException e) {
            return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(Map.of("status", "lock_timeout"));
        } catch (UnknownReservationStrategyException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", "unknown_strategy"));
        }
    }
}
```

- [ ] **Step 2: controller safety net 테스트가 통과하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.controller.ReservationControllerTest
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 3: 기존 k6 endpoint 호환성을 코드로 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.controller.ReservationControllerTest.reserveAtomic_compatibilityPathStillWorks
```

Expected:

```text
BUILD SUCCESSFUL
```

`POST /api/reservations/atomic`은 별도 메서드가 없어도 `@PostMapping("/{strategy}")`에서 `strategy=atomic`으로 처리된다.

- [ ] **Step 4: 커밋한다**

```bash
git add concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java
git commit -m "feat: route reservations through strategy use case"
```
