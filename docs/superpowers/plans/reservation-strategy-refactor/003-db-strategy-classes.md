# Reservation Strategy Refactor Implementation Plan - 003 DB Strategy Classes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `ReservationService`의 no-lock, pessimistic, optimistic 로직을 독립 전략 클래스로 옮긴다.

**Architecture:** 각 전략은 자기 transaction boundary와 필요한 dependency만 가진다. Optimistic 전략은 기존 Micrometer retry counter와 `TransactionTemplate` 사용 방식을 유지한다.

**Tech Stack:** Spring Transaction, Micrometer, Spring Data JPA, Java 21.

---

## Task 003: DB Strategy Classes

**Files:**

- Create: `concurrency/src/main/java/com/example/concurrency/service/strategy/NoLockReservationStrategy.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/strategy/PessimisticLockReservationStrategy.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/strategy/OptimisticLockReservationStrategy.java`

- [ ] **Step 1: NoLockReservationStrategy를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/strategy/NoLockReservationStrategy.java`:

```java
package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class NoLockReservationStrategy implements ReservationStrategy {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public NoLockReservationStrategy(ConcertRepository concertRepository,
                                     ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Override
    public String name() {
        return "no-lock";
    }

    @Override
    @Transactional
    public void reserve(ReservationCommand command) {
        Concert concert = concertRepository.findById(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        if (concert.getRemainingSeats() <= 0) {
            throw new SoldOutException();
        }

        concert.decreaseRemainingSeats();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
```

- [ ] **Step 2: PessimisticLockReservationStrategy를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/strategy/PessimisticLockReservationStrategy.java`:

```java
package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PessimisticLockReservationStrategy implements ReservationStrategy {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public PessimisticLockReservationStrategy(ConcertRepository concertRepository,
                                              ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Override
    public String name() {
        return "pessimistic";
    }

    @Override
    @Transactional
    public void reserve(ReservationCommand command) {
        Concert concert = concertRepository.findByIdWithPessimisticLock(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
```

- [ ] **Step 3: OptimisticLockReservationStrategy를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/strategy/OptimisticLockReservationStrategy.java`:

```java
package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.ReservationCommand;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.OptimisticLockException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class OptimisticLockReservationStrategy implements ReservationStrategy {

    private static final int MAX_OPTIMISTIC_ATTEMPTS = 5;

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
    private final TransactionTemplate transactionTemplate;
    private final Counter optimisticRetryCounter;

    public OptimisticLockReservationStrategy(ConcertRepository concertRepository,
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

    @Override
    public String name() {
        return "optimistic";
    }

    @Override
    public void reserve(ReservationCommand command) {
        int attempts = 0;

        while (attempts < MAX_OPTIMISTIC_ATTEMPTS) {
            try {
                transactionTemplate.executeWithoutResult(status -> reserveOnce(command));
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

    private void reserveOnce(ReservationCommand command) {
        Concert concert = concertRepository.findById(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
```

- [ ] **Step 4: Spring context가 네 전략을 모두 등록하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.service.ReservationStrategyRegistryTest
```

Expected:

```text
BUILD SUCCESSFUL
```

이 테스트는 Spring context를 띄우지 않지만 새 클래스들이 컴파일되는지 확인한다. 전체 context 검증은 Task 004에서 controller 테스트로 수행한다.

- [ ] **Step 5: 커밋한다**

```bash
git add concurrency/src/main/java/com/example/concurrency/service/strategy
git commit -m "feat: split db reservation strategies"
```
