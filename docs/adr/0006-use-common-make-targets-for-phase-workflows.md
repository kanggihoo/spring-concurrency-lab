# 0006. Use Common Make Targets for Phase Workflows

## Status

Accepted

## Context

ADR 0002 established the root `Makefile` as the official command interface for repeated project work. That decision kept user-facing commands in one place, but Phase 3 and Phase 4 later added phase-specific targets such as:

- `phase3-grafana-capture`
- `phase3-grafana-stitch`
- `phase3-sql-consistency`
- `phase4-sql-consistency`

Those targets were useful for preserving phase runbooks, but extending the same pattern to Phase 5 Redis and Phase 6 Idempotency would make the Makefile a growing list of phase names instead of a stable command interface. This would recreate the same drift problem already addressed in ADR 0003 for application code and ADR 0004 for Grafana dashboards.

The command interface also had one overloaded variable:

```text
PRESET
```

In k6 execution, `PRESET` meant the preset file under `k6/presets/*.json`. In Grafana capture, `PRESET` meant the dashboard variable and Prometheus label. These values are not always the same. For example, a k6 file can be `phase3-pessimistic-baseline.json` while the Grafana `preset` label remains `baseline`.

## Decision

Use common Make targets for phase workflows. A Make target should describe the work being performed, not the phase that needs it.

The stable user-facing targets are:

```text
k6-run
k6-evidence
grafana-generate
grafana-capture
evidence-capture
evidence-postprocess
grafana-stitch
sql-consistency
phase-status
k6-verify
```

Phase-specific context is passed through explicit variables:

```text
PHASE
GRAFANA_PHASE
SCENARIO
K6_PRESET
GRAFANA_PRESET
POOL
CONDITION
EXPERIMENT
SQL_OUTPUT
```

The root `Makefile` remains the official entrypoint, but target implementations are split by responsibility under:

```text
makefiles/
  config.mk
  help.mk
  env.mk
  app.mk
  k6.mk
  grafana.mk
  evidence.mk
  sql.mk
  phase-compat.mk
```

Existing phase-specific targets are retained only as compatibility wrappers. They must delegate to common targets instead of calling scripts directly.

## Target Addition Rule

New phase workflows must not add targets like:

```text
phase5-grafana-capture
phase5-sql-consistency
phase6-grafana-capture
phase6-idempotency-capture
```

Use a common target with explicit variables instead.

Example:

```bash
make evidence-capture \
  PHASE=06-idempotency/duplicate-request \
  K6_PRESET=phase6-idempotency-duplicate-request \
  GRAFANA_PHASE=phase-06 \
  SCENARIO=idempotency \
  GRAFANA_PRESET=duplicate-request \
  CONDITION=baseline
```

If an old phase runbook already documents a phase-specific target, that target can remain in `makefiles/phase-compat.mk` as a wrapper. It should not become the model for new phase work.

## Variable Contract

`PRESET` remains only for backwards compatibility. New commands and new documentation should use the more precise variables:

- `K6_PRESET`: k6 preset file name under `k6/presets/`
- `GRAFANA_PRESET`: Grafana `preset` dashboard variable and Prometheus label

`PHASE` and `GRAFANA_PHASE` also remain separate:

- `PHASE`: documentation and evidence path under `docs/evidence/`
- `GRAFANA_PHASE`: Prometheus/Grafana label value such as `phase-03`

Grafana capture uses `PARTS_DIR=docs/evidence/$(PHASE)/grafana/parts` by default so that `RUN_WINDOW=auto` resolves the latest run-window from the same phase evidence directory.

SQL consistency uses `SQL_OUTPUT` as the final output path. The default path supports Phase 4's `PHASE/EXPERIMENT/CONDITION` structure, while compatibility wrappers can pass `SQL_OUTPUT` directly for older evidence layouts such as Phase 3.

## Consequences

Benefits:

- New phases can reuse the same command interface without growing phase-specific Make targets.
- k6 file names and Grafana label values no longer have to be forced into one `PRESET` variable.
- The root `Makefile` stays small, while implementation details live in focused `makefiles/*.mk` files.
- Existing Phase 3 and Phase 4 runbooks remain reproducible through compatibility wrappers.
- The command interface now follows the same additive, integrated-project policy as reservation strategies and Grafana dashboards.

Trade-offs:

- Some commands become more explicit because callers pass `K6_PRESET`, `GRAFANA_PRESET`, `PHASE`, and `GRAFANA_PHASE` separately.
- Compatibility wrappers remain in the repo, so there are still phase-specific target names for historical phases.
- Contributors must understand the difference between evidence paths and metric labels.

## Alternatives Considered

### Keep adding phase-specific Make targets

This keeps individual phase commands short, but it makes Makefile maintenance worse as phases grow. It also hides common behavior behind many near-duplicate targets.

### Remove all phase-specific targets immediately

This creates the cleanest command surface, but it breaks existing phase runbooks and makes old evidence reproduction harder. Compatibility wrappers provide a better transition.

### Keep a single large root Makefile

This avoids include files, but it keeps unrelated command logic in one file and makes branch conflicts more likely as k6, Grafana, SQL, and evidence workflows evolve.
