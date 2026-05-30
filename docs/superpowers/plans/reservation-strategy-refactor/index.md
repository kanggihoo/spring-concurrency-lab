# Reservation Strategy Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4까지의 예약 애플리케이션을 전략 선택형 구조로 리팩토링해 Phase 5 Redis와 Phase 6 Idempotency가 새 파일 중심으로 추가되게 만든다.

**Architecture:** `ReservationController`는 요청을 `ReservationUseCase`에 위임하고, `ReservationUseCase`는 `ReservationStrategyRegistry`에서 전략을 찾아 실행한다. 기존 `ReservationService`의 메서드는 `NoLock`, `Pessimistic`, `Optimistic`, `Atomic` 전략 클래스로 분리한다.

**Tech Stack:** Java 21, Spring Boot 4, Spring MVC, Spring Data JPA, PostgreSQL, Testcontainers, JUnit 5, AssertJ, MockMvc.

---

## Source Spec

- `docs/superpowers/specs/2026-05-30-reservation-strategy-refactor-design.md`

## 전제

- 현재 브랜치: `codex/integrate-strategy-refactor`
- 기준 코드: `codex/phase4-db-operational-limits`
- Phase 3 최신 문서/evidence 회수 커밋: `docs: recover phase3 evidence hardening artifacts`
- Phase 5 Redis 코드는 이 계획에서 이식하지 않는다.
- Phase 6 Idempotency 코드는 이 계획에서 구현하지 않는다.

## 실행 순서

1. [000-controller-safety-net.md](./000-controller-safety-net.md)
2. [001-strategy-contract-registry-usecase.md](./001-strategy-contract-registry-usecase.md)
3. [002-atomic-writer-and-atomic-strategy.md](./002-atomic-writer-and-atomic-strategy.md)
4. [003-db-strategy-classes.md](./003-db-strategy-classes.md)
5. [004-controller-generic-dispatch.md](./004-controller-generic-dispatch.md)
6. [005-test-migration-and-service-removal.md](./005-test-migration-and-service-removal.md)
7. [006-final-verification-and-docs.md](./006-final-verification-and-docs.md)

## 파일 맵

생성:

- `concurrency/src/main/java/com/example/concurrency/service/ReservationCommand.java`
- `concurrency/src/main/java/com/example/concurrency/service/UnknownReservationStrategyException.java`
- `concurrency/src/main/java/com/example/concurrency/service/ReservationStrategyRegistry.java`
- `concurrency/src/main/java/com/example/concurrency/service/ReservationUseCase.java`
- `concurrency/src/main/java/com/example/concurrency/service/DbReservationWriter.java`
- `concurrency/src/main/java/com/example/concurrency/service/strategy/ReservationStrategy.java`
- `concurrency/src/main/java/com/example/concurrency/service/strategy/NoLockReservationStrategy.java`
- `concurrency/src/main/java/com/example/concurrency/service/strategy/PessimisticLockReservationStrategy.java`
- `concurrency/src/main/java/com/example/concurrency/service/strategy/OptimisticLockReservationStrategy.java`
- `concurrency/src/main/java/com/example/concurrency/service/strategy/AtomicUpdateReservationStrategy.java`
- `concurrency/src/test/java/com/example/concurrency/service/ReservationStrategyRegistryTest.java`
- `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`

수정:

- `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`
- `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`
- `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`
- `docs/guides/commands.md`

삭제:

- `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`

## 커밋 단위

각 단계가 통과하면 다음 형식으로 커밋한다.

```bash
git add <changed files>
git commit -m "<type>: <short summary>"
```

권장 커밋:

- `test: add reservation controller strategy safety net`
- `feat: add reservation strategy registry`
- `feat: extract atomic reservation writer`
- `feat: split db reservation strategies`
- `feat: route reservations through strategy use case`
- `refactor: remove reservation service facade`
- `docs: document reservation strategy dispatch`

## 완료 기준

- 기존 endpoint가 계속 동작한다.
- `POST /api/reservations/{strategy}`가 `no-lock`, `pessimistic`, `optimistic`, `atomic` 전략을 실행한다.
- 알 수 없는 전략은 `404 {"status":"unknown_strategy"}`를 반환한다.
- `ReservationService`는 제거된다.
- `./gradlew test`가 통과한다.
