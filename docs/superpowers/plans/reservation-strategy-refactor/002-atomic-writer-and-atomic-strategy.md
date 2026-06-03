# Reservation Strategy Refactor Implementation Plan - 002 Atomic Writer and Atomic Strategy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomic Conditional Update 로직을 재사용 가능한 DB writer와 `ReservationStrategy` 구현체로 분리한다.

**Architecture:** `DbReservationWriter`는 DB 원자 차감과 Reservation 저장을 하나의 트랜잭션으로 수행한다. `AtomicUpdateReservationStrategy`는 전략 이름 `atomic`을 제공하고 writer에 위임한다.

**Tech Stack:** Spring Data JPA, Spring Transaction, Java 21.

---

## Task 002: Atomic Writer and Strategy

**Files:**

- Create: `concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/strategy/AtomicUpdateReservationStrategy.java`

- [ ] **Step 1: DbReservationWriter를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java`:

```java
package com.example.concurrency.service;

import com.example.concurrency.domain.Reservation;
import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
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

- [ ] **Step 2: AtomicUpdateReservationStrategy를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/strategy/AtomicUpdateReservationStrategy.java`:

```java
package com.example.concurrency.service.strategy;

import com.example.concurrency.service.DbReservationWriter;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;

@Component
public class AtomicUpdateReservationStrategy implements ReservationStrategy {

    private final DbReservationWriter dbReservationWriter;

    public AtomicUpdateReservationStrategy(DbReservationWriter dbReservationWriter) {
        this.dbReservationWriter = dbReservationWriter;
    }

    @Override
    public String name() {
        return "atomic";
    }

    @Override
    public void reserve(ReservationCommand command) {
        dbReservationWriter.reserveWithAtomicUpdate(command.concertId(), command.userId());
    }
}
```

- [ ] **Step 3: Spring context가 atomic 전략을 등록하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.ConcurrencyApplicationTests
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 4: 커밋한다**

```bash
git add \
  concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java \
  concurrency/src/main/java/com/example/concurrency/service/strategy/AtomicUpdateReservationStrategy.java
git commit -m "feat: extract atomic reservation writer"
```
