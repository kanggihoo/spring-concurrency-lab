# 0003. Use Integrated Strategy-Based Experiment App

## Status

Accepted

## Context

This project is a portfolio-oriented concurrency lab. The important output is not a preserved application snapshot for every phase, but the recorded explanation of what each phase tested and concluded.

The phase outputs are stored in:

- `docs/phases/`
- `docs/evidence/`
- `docs/roadmap/`

Before this decision, phase branches could drift because each phase changed the same application files, especially reservation service code, controller routes, scripts, Makefile targets, k6 presets, and observability configuration. Keeping those branches independently mergeable made later integration expensive and unclear.

The branch discussion resolved that Phase 3 and Phase 4 are the stable baseline for integration, while Phase 5 Redis work should be ported later onto the integrated structure.

## Decision

Use `main` as a single integrated experiment application.

Do not preserve each phase as a different long-lived application state. Preserve completed phase conclusions and raw evidence in documentation and evidence directories instead.

Reservation behaviors that need to be compared are represented as selectable strategies in the same application:

- `no-lock`
- `pessimistic`
- `optimistic`
- `atomic`

Future strategies, such as Redis or idempotency variants, must be added through the same strategy model instead of replacing existing behavior.

The application exposes a generic strategy endpoint:

```text
POST /api/reservations/{strategy}
```

Existing phase endpoints remain compatible where already used by k6 presets and reports:

```text
POST /api/reservations
POST /api/reservations/pessimistic
POST /api/reservations/optimistic
POST /api/reservations/atomic
```

## Strategy Addition Rule

A new Reservation strategy must follow these rules:

1. Add a new `ReservationStrategy` implementation.
2. Do not modify existing strategy classes to add unrelated phase behavior.
3. Do not add a central `switch`, `if/else`, or enum that must be edited for every strategy.
4. Use `ReservationStrategy.name()` as the stable public experiment identifier.
5. Align the strategy name with API paths, k6 preset labels, Grafana or Prometheus labels, evidence paths, and phase report terminology.
6. Use `/api/reservations/{strategy}` by default. Add controller-specific mappings only when preserving an existing public path.
7. Put reusable DB, Redis, idempotency, or external API operations behind small collaborators such as writers, stores, or clients instead of duplicating those operations inside multiple strategies.
8. Add at least a controller smoke test or strategy/use-case test for each new strategy.
9. Record the strategy name, endpoint, k6 preset, and evidence path in the relevant phase docs.

`ReservationStrategy.name()` is not an internal bean name. It is a public experiment contract shared by code, load tests, observability labels, evidence paths, and reports.

## Cross-Cutting Behavior Rule

Cross-cutting behavior should wrap existing strategies instead of changing their meaning.

Examples:

- Idempotency should not mutate the existing `atomic` strategy into an idempotent strategy.
- A Phase 6 idempotency experiment should add `idempotent-atomic` or an `IdempotentReservationUseCase` that wraps the `atomic` strategy.
- Payment-adjacent delay experiments should keep the underlying reservation strategy explicit instead of hiding external latency inside unrelated strategy implementations.

This keeps phase conclusions comparable. A report can say exactly which reservation behavior ran and which wrapper behavior was applied.

## Consequences

Benefits:

- Future phases start from latest `main` instead of long-lived phase branches.
- Merge conflicts move away from one large reservation service and toward additive strategy files.
- Phase reports remain stable because evidence is stored by phase, while code can continue to evolve.
- Phase 5 Redis and Phase 6 Idempotency can be added without rewriting Phase 2-4 strategy behavior.
- Strategy names create a consistent thread through API, k6, observability, evidence, and reports.

Trade-offs:

- The final app contains intentionally unsafe behavior such as `no-lock`.
- The app is an experiment harness, not a production-only service surface.
- Strategy names must be maintained carefully because they become public experiment identifiers.
- Some phase-specific historical application states are not directly recoverable from `main`; they are represented by docs, evidence, and git history instead.

## Alternatives Considered

### Keep one branch per phase as the source of truth

This preserves historical app states, but it keeps application code divergent and makes later merges difficult. It also overemphasizes branch state even though the portfolio goal is to explain phase conclusions and evidence.

### Merge Phase 5 directly into main

Phase 5 contains useful Redis work, but it also changes infrastructure, observability, load testing, and service code together. Merging it before stabilizing the strategy structure would make Redis-specific coupling part of the baseline.

### Keep `ReservationService` as the central strategy class

This is simple for a small number of strategies, but it creates a repeated conflict point as every phase adds or changes methods in the same file.
