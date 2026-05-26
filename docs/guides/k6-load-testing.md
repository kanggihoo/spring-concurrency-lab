# k6 Load Testing Guide

k6 실행 조건은 Phase 간 비교 가능성을 위해 preset 파일로 관리한다. 실행 방법은 [Commands Guide](./commands.md)를 기준으로 한다.

## Current Entry Point

```bash
make k6-run PRESET=baseline MODE=prometheus
```

`k6/run.sh`는 `k6/presets/<preset>.json`을 읽고 `k6/reservation-test.js`를 실행한다.

## Preset Types

| Preset | Purpose |
|---|---|
| `baseline` | 기본 동시 부하. Phase 2 completion gate에 사용한다. |
| `spike` | 순간 트래픽 급증을 관찰한다. |
| `ramp-up` | VU를 단계적으로 늘려 한계 구간을 찾는다. |
| `sustained` | 긴 시간 동안 DB와 런타임 압력을 관찰한다. |

## Result Recording

k6 결과는 Phase별 evidence 아래에 저장한다.

```text
docs/evidence/<phase>/k6/
```

`k6/run.sh`는 summary JSON을 `docs/evidence/<phase>/k6/`, terminal log를 `docs/evidence/<phase>/logs/`, Grafana 조회 시간창을 `docs/evidence/<phase>/grafana/` 아래에 저장한다.

최소 기록 값은 다음과 같다.

- RPS
- p95
- p99
- error rate
- preset name
- VU/duration or stages
- consistency snapshot when the preset captures it
