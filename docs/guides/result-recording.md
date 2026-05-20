# Result Recording Guide

실험 결과는 구현 코드와 분리해 `docs/evidence/`에 저장한다.

## Naming Rule

파일명은 다음 정보를 포함한다.

- Phase
- Strategy or scenario
- VU/duration
- Run number
- Result type

예시:

```text
pessimistic-lock-100vu-10s-run1-k6.json
redis-lua-500vu-10s-run2-grafana.png
no-lock-100vu-run1-consistency.sql
```

## Report Link Rule

`report.md`에는 evidence 파일 내용을 복사하지 않고 링크한다. 보고서에는 해석과 결론을 기록한다.

## Minimum Evidence

- k6 result
- consistency SQL result
- Grafana or Prometheus evidence
- application or DB log, when relevant
