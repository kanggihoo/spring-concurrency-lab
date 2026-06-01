# 0004. Use YAML as Grafana Dashboard Source of Truth

## Status

Accepted

## Context

This project uses Grafana dashboards as repeatable visual evidence for phase reports. Grafana is provisioned from JSON files under `grafana/dashboards/`, but editing generated JSON directly makes common observability changes hard to review and hard to reuse across phases.

The dashboard needs to evolve as phases add new evidence needs:

- Phase 3 and Phase 4 compare DB locking and operational limits.
- Phase 5 will add Redis-related metrics.
- Phase 6 will add idempotency-related metrics.

If each phase creates or rewrites its own dashboard JSON, dashboard layout, PromQL, capture scripts, and evidence references can drift the same way application code drifted before the integrated strategy refactor.

## Decision

Use YAML files under `scripts/grafana/` as the source of truth for Grafana dashboards.

Generated JSON files under `grafana/dashboards/` are provisioning artifacts. They are committed so Grafana can start quickly from Docker Compose, but they must not be hand-edited.

The project maintains one shared overview dashboard:

```text
grafana/dashboards/concurrency-lab-overview.json
```

The editable dashboard source is split by responsibility:

```text
scripts/grafana/dashboards/overview.yml
scripts/grafana/rows/*.yml
scripts/grafana/queries/*.yml
```

Responsibilities:

- `dashboards/overview.yml` defines dashboard metadata, Grafana variables, and row order.
- `rows/*.yml` defines row titles and panel lists.
- `queries/*.yml` defines PromQL aliases and expressions.
- `scripts/grafana/lib/*.js` compiles YAML into Grafana dashboard JSON.
- `scripts/generate-grafana-dashboards.js` remains the compatibility entrypoint for `npm run grafana:generate`.

## Dashboard Change Rule

Grafana dashboard changes must follow these rules:

1. Do not manually edit `grafana/dashboards/*.json`.
2. Add or change PromQL in `scripts/grafana/queries/*.yml`.
3. Add or change panel composition in `scripts/grafana/rows/*.yml`.
4. Add a new row to `scripts/grafana/dashboards/overview.yml` only when it should appear in the shared overview dashboard.
5. Keep dashboard variables stable unless the k6 label and evidence contract also changes.
6. Run `npm run grafana:test` after changing generator logic.
7. Run `npm run grafana:generate` after changing dashboard, row, or query YAML.
8. Commit the regenerated `grafana/dashboards/concurrency-lab-overview.json` with the YAML change.
9. Record important phase-specific dashboard evidence in the relevant phase report or evidence README.

The stable Grafana variables are:

```text
phase
scenario
preset
pool
uri
table
```

These names are part of the evidence contract shared by k6 labels, Prometheus queries, Grafana URLs, capture metadata, and phase reports.

## Phase Metric Addition Rule

When a phase needs additional metrics, add them to the shared dashboard instead of creating a phase-specific dashboard.

Example for Redis metrics:

1. Add Redis PromQL aliases to `scripts/grafana/queries/redis.yml`.
2. Add Redis panels to `scripts/grafana/rows/redis.yml`.
3. Add `redis` to the `rows` list in `scripts/grafana/dashboards/overview.yml`.
4. Regenerate `grafana/dashboards/concurrency-lab-overview.json`.
5. Capture evidence through the existing capture CLI with phase-specific variables.

This keeps the dashboard additive and prevents long-lived phase dashboard drift.

## Capture Boundary

Grafana capture configuration is not managed through dashboard YAML.

`scripts/capture-grafana-dashboard.js` remains a Playwright-based full-dashboard capture tool. It chooses:

- dashboard key through `--dashboard`
- data slice through `--phase`, `--scenario`, `--preset`, `--pool`, `--uri`, and `--table`
- time range through `--run-window`, `--from`, and `--to`
- output location through `--parts-dir`

The capture tool does not understand row or panel YAML and does not select individual panels. It captures the rendered dashboard scroll container.

The old `phase2` dashboard key is kept only as a compatibility alias for `overview`.

## Consequences

Benefits:

- PromQL changes are isolated from panel layout changes.
- Phase-specific metric additions become additive YAML changes.
- Generated Grafana JSON stays reproducible.
- Docker Compose provisioning remains simple because Grafana still reads JSON from `grafana/dashboards/`.
- Playwright capture remains operationally simple and continues to use CLI arguments and run-window files.

Trade-offs:

- Contributors must regenerate JSON after changing YAML.
- The overview dashboard can grow large as phases add more rows.
- Generated JSON diffs can still be noisy, but they are no longer the primary review surface.
- Dashboard variable names become a public evidence contract and must be changed carefully.

## Alternatives Considered

### Hand-edit Grafana JSON

This avoids generator code, but it makes changes difficult to review and easy to break. Grafana JSON contains layout, field config, targets, variables, and plugin defaults in one large file.

### Keep one dashboard per phase

This keeps each phase visually isolated, but it recreates the branch drift problem in observability assets. Common rows, variables, and PromQL would be copied across phase dashboards.

### Manage capture groups in dashboard YAML

This was rejected because capture is an evidence collection concern, not a dashboard definition concern. The current capture script captures the full rendered dashboard and should remain driven by CLI variables, run-window JSON, and output paths.
