# k6 Load Testing Guide

k6 실행 조건은 Phase 간 비교 가능성을 위해 고정하고, 변경이 필요한 경우 `report.md`에 이유를 기록한다.

## Scenario Types

| Scenario | Purpose |
|---|---|
| baseline | 기본 동시 부하 |
| spike | 순간 폭주 |
| ramp-up | 한계점 탐색 |
| sustained | 지속 부하 안정성 |

## Result Recording

k6 결과는 Phase별 evidence 아래에 저장한다.

```text
docs/evidence/<phase>/k6/
```

파일명은 비교 대상, VU, 실행 회차가 드러나게 작성한다.

```text
pessimistic-lock-100vu-run1.json
redis-lua-500vu-run3.json
```

## Required Values

- RPS
- p95
- p99
- max
- error rate
- scenario name
- VU/duration
