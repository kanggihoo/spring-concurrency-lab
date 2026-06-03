# 000. Foundation, Domain, and Repositories

### Task 000: Add Phase 3 Domain and Repository Foundation

**Files:**
- Modify: `concurrency/src/main/java/com/example/concurrency/domain/Concert.java`
- Modify: `concurrency/src/main/java/com/example/concurrency/repository/ConcertRepository.java`
- Create: `concurrency/src/main/java/com/example/concurrency/domain/SoldOutException.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/OptimisticLockRetryExhaustedException.java`
- Modify: `postgres/init/02_schema.sql`

- [ ] **Step 1: Add service exceptions**

Create `concurrency/src/main/java/com/example/concurrency/domain/SoldOutException.java`:

```java
package com.example.concurrency.domain;

public class SoldOutException extends RuntimeException {

    public SoldOutException() {
        super("Sold out.");
    }
}
```

Create `concurrency/src/main/java/com/example/concurrency/service/OptimisticLockRetryExhaustedException.java`:

```java
package com.example.concurrency.service;

public class OptimisticLockRetryExhaustedException extends RuntimeException {

    public OptimisticLockRetryExhaustedException(int attempts) {
        super("Optimistic lock retry exhausted. attempts=" + attempts);
    }
}
```

- [ ] **Step 2: Add `@Version` and guarded decrement to Concert**

Replace `concurrency/src/main/java/com/example/concurrency/domain/Concert.java` with:

```java
package com.example.concurrency.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "concert")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Concert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "remaining_seats", nullable = false)
    private int remainingSeats;

    @Version
    @Column(nullable = false)
    private Long version;

    public Concert(String title, int remainingSeats) {
        this.title = title;
        this.remainingSeats = remainingSeats;
        this.version = 0L;
    }

    public void resetRemainingSeats(int remainingSeats) {
        this.remainingSeats = remainingSeats;
    }

    public void decreaseRemainingSeats() {
        this.remainingSeats--;
    }

    public void reserveOneSeat() {
        if (this.remainingSeats <= 0) {
            throw new SoldOutException();
        }
        this.remainingSeats--;
    }
}
```

- [ ] **Step 3: Add repository lock and atomic update methods**

Replace `concurrency/src/main/java/com/example/concurrency/repository/ConcertRepository.java` with:

```java
package com.example.concurrency.repository;

import com.example.concurrency.domain.Concert;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ConcertRepository extends JpaRepository<Concert, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Concert c where c.id = :id")
    Optional<Concert> findByIdWithPessimisticLock(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Concert c
               set c.remainingSeats = c.remainingSeats - 1
             where c.id = :id
               and c.remainingSeats > 0
            """)
    int decreaseRemainingSeatsIfAvailable(@Param("id") Long id);
}
```

- [ ] **Step 4: Add version column to local PostgreSQL schema**

Replace `postgres/init/02_schema.sql` with:

```sql
-- Concert & Reservation schema for Phase 3 DB strategies

CREATE TABLE IF NOT EXISTS concert (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    remaining_seats INT NOT NULL DEFAULT 100,
    version         BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reservation (
    id         BIGSERIAL PRIMARY KEY,
    concert_id BIGINT NOT NULL REFERENCES concert(id),
    user_id    BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Initial data: one concert with 100 seats
INSERT INTO concert (title, remaining_seats, version) VALUES ('Concert A', 100, 0);
```

- [ ] **Step 5: Run existing Phase 2 tests**

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.controller.TestControllerTest
```

Expected: PASS.

Run:

```powershell
cd concurrency
.\gradlew.bat test --tests com.example.concurrency.ReservationConcurrencyTest
```

Expected: this test may fail after `@Version` because Phase 3 does not re-measure the Phase 2 no-lock baseline. If it fails with an optimistic locking exception or consistency expectation mismatch, mark it as Phase 2-only in Task 005 instead of weakening Phase 3 behavior.

- [ ] **Step 6: Commit**

```powershell
git add concurrency/src/main/java/com/example/concurrency/domain/Concert.java `
        concurrency/src/main/java/com/example/concurrency/repository/ConcertRepository.java `
        concurrency/src/main/java/com/example/concurrency/domain/SoldOutException.java `
        concurrency/src/main/java/com/example/concurrency/service/OptimisticLockRetryExhaustedException.java `
        postgres/init/02_schema.sql
git commit -m "feat: add phase3 db strategy foundation"
```
