# Reservation Strategy Refactor Implementation Plan - 001 Strategy Contract, Registry, Use Case

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전략 이름으로 예약 전략을 찾아 실행할 수 있는 최소 application boundary를 만든다.

**Architecture:** `ReservationStrategy`는 각 예약 방식의 공통 인터페이스다. `ReservationStrategyRegistry`는 Spring이 주입한 전략 목록을 이름으로 인덱싱하고, `ReservationUseCase`는 컨트롤러가 의존할 안정적인 진입점이다.

**Tech Stack:** Java 21, Spring Component, JUnit 5, AssertJ.

---

## Task 001: Strategy Contract, Registry, Use Case

**Files:**

- Create: `concurrency/src/main/java/com/example/concurrency/service/ReservationCommand.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/UnknownReservationStrategyException.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/strategy/ReservationStrategy.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/ReservationStrategyRegistry.java`
- Create: `concurrency/src/main/java/com/example/concurrency/service/ReservationUseCase.java`
- Create: `concurrency/src/test/java/com/example/concurrency/service/ReservationStrategyRegistryTest.java`

- [ ] **Step 1: registry 실패 테스트를 먼저 작성한다**

Create `concurrency/src/test/java/com/example/concurrency/service/ReservationStrategyRegistryTest.java`:

```java
package com.example.concurrency.service;

import com.example.concurrency.service.strategy.ReservationStrategy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReservationStrategyRegistryTest {

    @Test
    @DisplayName("전략 이름으로 ReservationStrategy를 조회한다")
    void get_returnsStrategyByName() {
        ReservationStrategy strategy = new TestStrategy("atomic");
        ReservationStrategyRegistry registry = new ReservationStrategyRegistry(List.of(strategy));

        assertThat(registry.get("atomic")).isSameAs(strategy);
    }

    @Test
    @DisplayName("없는 전략 이름은 UnknownReservationStrategyException을 던진다")
    void get_unknownName_throwsException() {
        ReservationStrategyRegistry registry = new ReservationStrategyRegistry(List.of(new TestStrategy("atomic")));

        assertThatThrownBy(() -> registry.get("missing"))
                .isInstanceOf(UnknownReservationStrategyException.class)
                .hasMessageContaining("Unknown reservation strategy: missing");
    }

    @Test
    @DisplayName("중복 전략 이름은 애플리케이션 시작 전에 실패한다")
    void constructor_duplicateStrategyName_throwsException() {
        assertThatThrownBy(() -> new ReservationStrategyRegistry(List.of(
                new TestStrategy("atomic"),
                new TestStrategy("atomic")
        )))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate reservation strategy: atomic");
    }

    @Test
    @DisplayName("ReservationUseCase는 registry에서 찾은 전략을 실행한다")
    void reserve_executesSelectedStrategy() {
        AtomicBoolean executed = new AtomicBoolean(false);
        ReservationStrategy strategy = new TestStrategy("atomic") {
            @Override
            public void reserve(ReservationCommand command) {
                executed.set(true);
            }
        };
        ReservationUseCase useCase = new ReservationUseCase(new ReservationStrategyRegistry(List.of(strategy)));

        useCase.reserve("atomic", new ReservationCommand(1L, 10L));

        assertThat(executed).isTrue();
    }

    private static class TestStrategy implements ReservationStrategy {

        private final String name;

        private TestStrategy(String name) {
            this.name = name;
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public void reserve(ReservationCommand command) {
        }
    }
}
```

- [ ] **Step 2: 테스트가 컴파일 실패하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.service.ReservationStrategyRegistryTest
```

Expected:

```text
Compilation failed
cannot find symbol: class ReservationStrategyRegistry
cannot find symbol: class ReservationCommand
```

- [ ] **Step 3: ReservationCommand를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/ReservationCommand.java`:

```java
package com.example.concurrency.service;

public record ReservationCommand(Long concertId, Long userId) {
}
```

- [ ] **Step 4: UnknownReservationStrategyException을 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/UnknownReservationStrategyException.java`:

```java
package com.example.concurrency.service;

public class UnknownReservationStrategyException extends RuntimeException {

    public UnknownReservationStrategyException(String strategyName) {
        super("Unknown reservation strategy: " + strategyName);
    }
}
```

- [ ] **Step 5: ReservationStrategy 인터페이스를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/strategy/ReservationStrategy.java`:

```java
package com.example.concurrency.service.strategy;

import com.example.concurrency.service.ReservationCommand;

public interface ReservationStrategy {

    String name();

    void reserve(ReservationCommand command);
}
```

- [ ] **Step 6: ReservationStrategyRegistry를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/ReservationStrategyRegistry.java`:

```java
package com.example.concurrency.service;

import com.example.concurrency.service.strategy.ReservationStrategy;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class ReservationStrategyRegistry {

    private final Map<String, ReservationStrategy> strategies;

    public ReservationStrategyRegistry(List<ReservationStrategy> strategies) {
        Map<String, ReservationStrategy> collected = new LinkedHashMap<>();
        for (ReservationStrategy strategy : strategies) {
            ReservationStrategy previous = collected.put(strategy.name(), strategy);
            if (previous != null) {
                throw new IllegalStateException("Duplicate reservation strategy: " + strategy.name());
            }
        }
        this.strategies = Collections.unmodifiableMap(collected);
    }

    public ReservationStrategy get(String name) {
        ReservationStrategy strategy = strategies.get(name);
        if (strategy == null) {
            throw new UnknownReservationStrategyException(name);
        }
        return strategy;
    }

    public Set<String> names() {
        return strategies.keySet();
    }
}
```

- [ ] **Step 7: ReservationUseCase를 만든다**

Create `concurrency/src/main/java/com/example/concurrency/service/ReservationUseCase.java`:

```java
package com.example.concurrency.service;

import org.springframework.stereotype.Service;

@Service
public class ReservationUseCase {

    private final ReservationStrategyRegistry reservationStrategyRegistry;

    public ReservationUseCase(ReservationStrategyRegistry reservationStrategyRegistry) {
        this.reservationStrategyRegistry = reservationStrategyRegistry;
    }

    public void reserve(String strategyName, ReservationCommand command) {
        reservationStrategyRegistry.get(strategyName).reserve(command);
    }
}
```

- [ ] **Step 8: registry 테스트가 통과하는지 확인한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.service.ReservationStrategyRegistryTest
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 9: 커밋한다**

```bash
git add \
  concurrency/src/main/java/com/example/concurrency/service/ReservationCommand.java \
  concurrency/src/main/java/com/example/concurrency/service/UnknownReservationStrategyException.java \
  concurrency/src/main/java/com/example/concurrency/service/ReservationStrategyRegistry.java \
  concurrency/src/main/java/com/example/concurrency/service/ReservationUseCase.java \
  concurrency/src/main/java/com/example/concurrency/service/strategy/ReservationStrategy.java \
  concurrency/src/test/java/com/example/concurrency/service/ReservationStrategyRegistryTest.java
git commit -m "feat: add reservation strategy registry"
```
