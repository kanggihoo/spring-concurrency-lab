# Reservation Strategy Refactor Implementation Plan - 006 Final Verification and Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리팩토링된 전략 실행 구조를 문서화하고 전체 테스트로 main 병합 가능 상태를 확인한다.

**Architecture:** 코드 변경은 Task 005에서 끝난다. 이 단계는 명령 문서에 strategy endpoint 정책을 기록하고 전체 검증을 수행한다.

**Tech Stack:** Markdown, Gradle, JUnit 5.

---

## Task 006: Final Verification and Docs

**Files:**

- Modify: `docs/guides/commands.md`

- [ ] **Step 1: commands guide에 strategy endpoint 정책을 추가한다**

In `docs/guides/commands.md`, add this section after the `## k6` section or before `## Grafana`:

```markdown
## Reservation Strategy Endpoint

예약 API는 Phase 2-4의 기존 경로를 유지하면서 strategy 이름으로 실행할 수 있다.

| Strategy | Endpoint |
|---|---|
| No Lock baseline | `POST /api/reservations` |
| No Lock baseline | `POST /api/reservations/no-lock` |
| Pessimistic Lock | `POST /api/reservations/pessimistic` |
| Optimistic Lock + Retry | `POST /api/reservations/optimistic` |
| Atomic Conditional Update | `POST /api/reservations/atomic` |

알 수 없는 strategy는 `404 {"status":"unknown_strategy"}`를 반환한다.

k6 preset은 기존 path를 그대로 사용할 수 있고, 이후 Phase는 새 strategy path를 추가하는 방식으로 확장한다.
```

- [ ] **Step 2: 전체 테스트를 실행한다**

Run:

```bash
cd concurrency && ./gradlew test
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 3: 핵심 endpoint 테스트를 한 번 더 좁혀서 실행한다**

Run:

```bash
cd concurrency && ./gradlew test --tests com.example.concurrency.controller.ReservationControllerTest
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 4: 중앙 service 제거 상태를 확인한다**

Run:

```bash
test ! -f concurrency/src/main/java/com/example/concurrency/service/ReservationService.java
rg "reserveWithPessimisticLock|reserveWithOptimisticLock|reserveWithAtomicUpdate" concurrency/src/main/java
```

Expected:

```text
first command exits 0
second command has no matches
```

- [ ] **Step 5: Git diff를 검토한다**

Run:

```bash
git diff --stat HEAD
git diff --name-status HEAD
```

Expected changed areas:

```text
concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java
concurrency/src/main/java/com/example/concurrency/service/
concurrency/src/main/java/com/example/concurrency/service/strategy/
concurrency/src/test/java/com/example/concurrency/
concurrency/src/test/java/com/example/concurrency/controller/
docs/guides/commands.md
```

- [ ] **Step 6: 커밋한다**

```bash
git add docs/guides/commands.md
git commit -m "docs: document reservation strategy dispatch"
```

- [ ] **Step 7: main 병합 전 최종 상태를 기록한다**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected:

```text
working tree clean
latest commits include strategy refactor commits
```
