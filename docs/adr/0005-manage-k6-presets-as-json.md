# 0005. Manage k6 Presets as JSON

## Status

Accepted

## Context

This project uses k6 presets to define repeatable load-test conditions for phase evidence. Each preset describes one executable k6 run, including:

- phase and evidence labels
- scenario name
- preset name
- connection pool label
- reservation endpoint path
- executor shape
- VU count or ramping stages
- thresholds
- expected HTTP statuses
- reset and consistency capture flags

The current k6 execution flow reads presets from:

```text
k6/presets/*.json
```

`k6/run.sh` uses the preset file to derive evidence paths, log names, summary paths, Grafana run-window metadata, and k6 environment variables. `k6/reservation-test.js` then reads the same preset JSON through `__ENV.PRESET`.

## Decision

Keep `k6/presets/*.json` as the source of truth for k6 load-test presets.

k6 preset files are not generated artifacts. They are hand-maintained executable experiment definitions.

The stable execution entrypoints remain:

```text
bash k6/run.sh <preset> <mode>
make k6-run PRESET=<preset> MODE=<mode>
make k6-evidence PRESET=<preset> MODE=<mode>
```

## Preset Change Rule

k6 preset changes must follow these rules:

1. Edit `k6/presets/*.json` directly.
2. Keep each JSON file as one executable k6 preset.
3. Keep `phase`, `scenario`, `preset`, and `pool` labels stable because they are shared by Prometheus metrics, Grafana variables, capture metadata, evidence paths, and phase reports.
4. Keep `evidenceDir` aligned with the target phase evidence directory.
5. Use explicit `expectedStatuses` when a preset accepts responses outside the default `200` and `409` contract.
6. Keep `executor` to a supported k6 executor shape.
7. Run k6 preset verification after changing preset files.
8. Record phase-specific load-test intent in the relevant phase runbook or report.

Required preset fields:

```text
phase
evidenceDir
scenario
preset
pool
executor
```

Supported executor shapes:

- `constant-vus` with `vus` and `duration`
- `ramping-vus` with `startVUs` and `stages`

## Label Contract

The following labels are part of the k6 evidence contract:

```text
phase
scenario
preset
pool
```

Changing these labels affects:

- Prometheus k6 metrics
- Grafana dashboard variables
- Grafana capture URLs
- run-window metadata
- phase reports
- evidence directory references

Label changes must be treated as evidence-contract changes, not as local preset cleanup.

## Consequences

Benefits:

- The file a contributor edits is the same file k6 executes.
- There is no generated preset synchronization step.
- `k6/run.sh` and Makefile commands remain simple.
- Preset diffs show the exact load-test condition that changed.
- Phase evidence remains reproducible from committed JSON presets.

Trade-offs:

- Some fields are repeated across presets.
- Phase-level experiment groups are represented by file naming and phase docs, not by a separate grouping format.
- If preset count or request configuration complexity grows substantially, JSON files may become harder to scan.

## Reconsideration Triggers

Revisit this decision if one or more of the following become true:

- k6 preset count grows enough that phase-level experiment intent is hard to understand from JSON files and phase docs.
- Phase 6 or later phases require complex request/header/body classification settings in many presets.
- preset documentation or evidence matrices need to be generated automatically from a richer source model.
- repeated JSON fields become a frequent branch-conflict source.

Until then, JSON remains the canonical k6 preset format for this project.
