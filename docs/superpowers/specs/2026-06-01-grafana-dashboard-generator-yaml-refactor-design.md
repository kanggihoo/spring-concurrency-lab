# Grafana Dashboard Generator YAML Refactor Design

## 배경

현재 Grafana 대시보드는 `scripts/generate-grafana-dashboards.js`에서 생성한다. 이 파일은 다음 책임을 한 파일에 함께 가지고 있다.

- Grafana dashboard 공통 JSON 구조 생성
- Prometheus datasource, variable, target, panel helper 정의
- k6, Spring, HikariCP, PostgreSQL, Reservation 관련 PromQL 정의
- Overview dashboard row/panel layout 구성
- Phase 2 전용 dashboard row/panel layout 구성
- `grafana/dashboards/*.json` 파일 출력

이 구조는 초기 Phase 2 관측 환경을 빠르게 만들기에는 충분했지만, Phase 3 이후 여러 전략과 Phase 5 Redis, Phase 6 Idempotency처럼 관측 대상이 늘어나면 수정 지점이 한 파일에 집중된다. 특정 phase에서 필요한 metric이나 panel을 추가할 때 generator 전체를 읽어야 하고, branch 간 충돌도 커질 수 있다.

이 프로젝트에서 중요한 것은 phase별 애플리케이션 상태를 따로 유지하는 것이 아니라, 같은 실험 앱과 같은 관측 체계 위에서 phase별 결론과 evidence를 명확히 남기는 것이다. 따라서 Grafana도 phase별 dashboard 파일을 계속 늘리기보다, 공통 overview dashboard를 확장 가능한 구조로 관리한다.

## 목표

- dashboard 정의를 사람이 읽기 쉬운 YAML로 옮긴다.
- PromQL 정의와 panel 배치를 분리한다.
- phase별 추가 metric은 row와 query를 추가하는 방식으로 확장한다.
- generated JSON은 계속 `grafana/dashboards/` 아래에 출력해서 기존 Grafana provisioning 방식을 유지한다.
- `npm run grafana:generate` 명령은 계속 동작하게 한다.
- Playwright 캡처 스크립트는 dashboard 전체 캡처 도구로 유지한다.

## 비목표

- Grafana UI에서 row/panel을 선택적으로 캡처하는 기능은 이번 범위에 포함하지 않는다.
- 캡처 대상, evidence output path, run-window 선택을 YAML로 관리하지 않는다.
- Phase별 dashboard YAML 파일을 만들지 않는다.
- Grafana JSON을 사람이 직접 편집하는 구조로 되돌리지 않는다.
- k6 실행, screenshot stitching, report 생성 파이프라인은 변경하지 않는다.

## 결정

Dashboard generator를 YAML spec 기반 compiler 구조로 전환한다.

YAML은 "무엇을 보여줄지"만 표현한다. JavaScript는 YAML을 읽어서 Grafana dashboard JSON으로 변환한다. 생성된 JSON은 여전히 Grafana provisioning이 읽는 최종 산출물이며, 사람이 주로 수정하는 source of truth는 `scripts/grafana/**/*.yml`이다.

최종 dashboard는 `concurrency-lab-overview` 중심으로 운영한다. Phase 2 전용 dashboard는 제거하고, Phase 2에서 필요했던 consistency panel은 overview dashboard의 row로 편입한다.

## 파일 구조

```text
scripts/
  generate-grafana-dashboards.js

  grafana/
    generate.js

    dashboards/
      overview.yml

    rows/
      run-summary.yml
      k6-load.yml
      spring-api.yml
      spring-runtime.yml
      hikari-pool.yml
      postgres-activity.yml
      table-access.yml
      reservation-consistency.yml
      redis.yml
      idempotency.yml

    queries/
      k6.yml
      spring.yml
      hikari.yml
      postgres.yml
      reservation.yml
      redis.yml
      idempotency.yml

    lib/
      dashboard-compiler.js
      grafana-builder.js
      query-registry.js
      layout.js
      yaml-loader.js
      write-dashboard.js
```

`scripts/generate-grafana-dashboards.js`는 기존 명령 호환을 위해 thin wrapper로 남긴다. 실제 구현은 `scripts/grafana/generate.js`로 이동한다.

## Dashboard YAML

`scripts/grafana/dashboards/overview.yml`은 dashboard 전체의 메타데이터와 row 순서만 관리한다.

```yaml
uid: concurrency-lab-overview
slug: concurrency-lab-overview
output: concurrency-lab-overview.json
title: Concurrency Lab Overview
tags:
  - concurrency-lab
  - reservation
  - observability

variables:
  phase:
    label: Phase
    query: label_values(k6_http_reqs_total, phase)
    default: phase-02
  scenario:
    label: Scenario
    query: label_values(k6_http_reqs_total{phase="$phase"}, scenario)
    default: no-lock
  preset:
    label: Preset
    query: label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario"}, preset)
    default: baseline
  pool:
    label: Pool
    query: label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset"}, pool)
    default: default
  uri:
    label: URI
    query: label_values(http_server_requests_seconds_count, uri)
    default: $__all
    includeAll: true
    multi: true
  table:
    label: Table
    query: label_values(pg_stat_user_tables_seq_scan, relname)
    default: $__all
    includeAll: true
    multi: true

rows:
  - run-summary
  - k6-load
  - spring-api
  - spring-runtime
  - hikari-pool
  - postgres-activity
  - table-access
  - reservation-consistency
```

`variables`는 Grafana dashboard variable 정의다. 환경변수가 아니다. Grafana UI 상단의 드롭다운을 만들고, PromQL 안의 `$phase`, `$scenario`, `$preset`, `$pool`, `$uri`, `$table` 값을 Grafana가 런타임에 치환한다.

캡처 스크립트가 URL에 `var-phase=phase-03` 같은 값을 넘기면, Grafana는 PromQL의 `$phase`를 해당 값으로 적용한다.

## Row YAML

`scripts/grafana/rows/*.yml`은 하나의 dashboard row와 그 안의 panel 목록을 정의한다.

```yaml
id: run-summary
title: Run Summary
panels:
  - type: stat
    title: k6 p95
    query: k6.http.p95
    unit: s
    calc: max

  - type: stat
    title: Actual RPS
    query: k6.http.rps
    unit: reqps
    calc: max

  - type: stat
    title: Error Rate
    query: k6.http.error-rate
    unit: percent
```

Row 파일에는 phase scope를 넣지 않는다. `rows/redis.yml`은 "Redis row가 어떻게 생겼는지"만 설명한다. 어느 phase evidence에서 Redis row가 의미 있는지는 phase 문서와 캡처 명령에서 관리한다.

## Query YAML

`scripts/grafana/queries/*.yml`은 panel에서 사용할 PromQL alias를 정의한다.

```yaml
k6.http.p95:
  expr: max(k6_http_req_duration_p95{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"})
  zeroWhenNoData: true

k6.http.rps:
  expr: sum(rate(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}[$__rate_interval]))
  zeroWhenNoData: true

k6.http.error-rate:
  expr: avg(k6_http_req_failed_rate{phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"}) * 100
  zeroWhenNoData: true
```

연결 규칙은 하나다.

```text
rows/*.yml 의 panel.query 값 == queries/*.yml 의 key
```

예를 들어 row panel에 `query: k6.http.p95`가 있으면 generator는 `queries/k6.yml` 또는 다른 query 파일에서 같은 key를 찾아 Grafana target expression으로 변환한다.

## Phase별 Metric 추가 방식

Phase별로 새로운 관측 항목이 필요하면 dashboard 파일을 새로 만들지 않는다.

예를 들어 Phase 5 Redis metric을 추가할 때는 다음 순서로 확장한다.

1. `scripts/grafana/queries/redis.yml`에 PromQL alias를 추가한다.
2. `scripts/grafana/rows/redis.yml`에 Redis row와 panel을 추가한다.
3. `scripts/grafana/dashboards/overview.yml`의 `rows` 목록에 `redis`를 추가한다.
4. Phase 5 문서에는 어떤 row/panel을 근거로 결론을 냈는지 기록한다.
5. 캡처는 기존 방식대로 `--dashboard overview --phase phase-05 --scenario ...`로 실행한다.

이 방식은 phase별 dashboard 파일을 늘리지 않으면서도, phase별로 필요한 관측 row를 overview dashboard에 점진적으로 추가할 수 있다.

## Layout 규칙

초기 구현은 Grafana JSON의 grid position을 YAML에 과도하게 노출하지 않는다.

- row는 `overview.yml`의 `rows` 순서대로 배치한다.
- row header는 높이 `1`, 너비 `24`를 기본값으로 한다.
- `stat` panel은 기본 `w=6`, `h=4`를 사용한다.
- `timeseries` panel은 기본 `w=12`, `h=8`을 사용한다.
- panel은 row 안에서 왼쪽에서 오른쪽으로 채우고, `24` 너비를 넘으면 다음 줄로 내린다.
- 특수한 panel만 `w`, `h`, `x`, `y` override를 허용한다.

이렇게 하면 대부분의 panel 추가는 위치 계산을 직접 하지 않아도 된다. 기존 dashboard와 완전히 같은 배치가 필요한 경우에만 명시적 layout override를 사용한다.

## Capture Script와의 경계

`scripts/capture-grafana-dashboard.js`는 계속 Playwright 기반 전체 dashboard 캡처 도구로 유지한다.

현재 캡처 스크립트의 책임은 다음과 같다.

- dashboard UID/slug로 Grafana URL을 만든다.
- `phase`, `scenario`, `preset`, `pool`, `uri`, `table` 변수를 URL query parameter로 전달한다.
- run-window JSON에서 `from`, `to`를 읽어 evidence 시간 구간을 고정한다.
- Grafana dashboard scroll container 전체를 위에서 아래까지 캡처한다.
- 캡처 metadata와 screenshot part를 evidence directory에 저장한다.

따라서 "무슨 row/panel을 캡처할지"를 YAML로 따로 관리하지 않는다. 캡처 대상은 dashboard 전체다. 어떤 phase 데이터를 볼지는 URL variable과 run-window가 결정하고, 어디에 저장할지는 `--parts-dir`이 결정한다.

Phase별 캡처 실행 조건은 Makefile, CLI option, run-window JSON에서 관리한다.

## Capture Script 최소 변경

Generator 리팩토링과 함께 capture script는 필요한 최소 변경만 한다.

- `overview` dashboard는 계속 지원한다.
- default dashboard는 `phase2`에서 `overview`로 변경한다.
- 기존 `--dashboard phase2` 호출은 즉시 깨지지 않도록 `overview`로 해석하는 호환 alias로 남긴다.
- `--phase`, `--scenario`, `--preset`, `--pool`, `--uri`, `--table`, `--run-window`, `--parts-dir` 옵션은 유지한다.

캡처 스크립트가 row/panel selector를 직접 이해하도록 확장하는 것은 이번 범위에 포함하지 않는다.

## Dependency

YAML parsing을 위해 Node devDependency가 필요하다.

추천 패키지는 `yaml`이다.

```bash
npm install --save-dev yaml
```

`package-lock.json`도 함께 갱신한다.

## 마이그레이션 전략

1. 기존 generated JSON을 기준선으로 확인한다.
2. `scripts/grafana/lib`에 compiler와 builder를 추가한다.
3. 기존 JS의 PromQL을 `queries/*.yml`로 옮긴다.
4. 기존 JS의 row/panel 구성을 `rows/*.yml`로 옮긴다.
5. `dashboards/overview.yml`을 추가한다.
6. `scripts/grafana/generate.js`가 YAML을 읽어 `grafana/dashboards/concurrency-lab-overview.json`을 생성하게 한다.
7. `scripts/generate-grafana-dashboards.js`는 새 entrypoint를 호출하는 wrapper로 바꾼다.
8. Phase 2 전용 dashboard JSON 생성을 제거하고, 기존 `phase2` capture alias는 `overview` 호환 alias로 정리한다.

마이그레이션 중에는 한 번에 모든 기능을 바꾸지 않는다. 먼저 overview dashboard를 생성하고, JSON parse와 주요 panel 검증을 통과시킨 뒤 Phase 2 전용 dashboard 제거와 capture alias 정리를 별도 단계로 진행한다.

## 검증

다음 검증을 통과해야 한다.

- `npm run grafana:generate`가 성공한다.
- `grafana/dashboards/concurrency-lab-overview.json`이 생성된다.
- 생성된 JSON을 `JSON.parse`로 읽을 수 있다.
- dashboard `uid`는 `concurrency-lab-overview`이다.
- Grafana variables는 `phase`, `scenario`, `preset`, `pool`, `uri`, `table`을 포함한다.
- 모든 row panel의 `query` alias가 `queries/*.yml`에 존재한다.
- 모든 panel target에는 Grafana `refId`가 순서대로 부여된다.
- `zeroWhenNoData: true` query는 `or on() vector(0)` fallback을 가진다.
- Docker Compose Grafana provisioning이 generated JSON을 로드할 수 있다.
- 기존 `npm run grafana:capture -- --dashboard overview ...` 흐름이 유지된다.

## 기대 효과

- Phase별 metric 추가가 `queries/*.yml`과 `rows/*.yml` 추가로 제한된다.
- PromQL 수정과 dashboard layout 수정이 분리된다.
- Generator JS는 Grafana JSON 변환 로직에 집중한다.
- generated JSON은 계속 provisioning artifact로 남아 Grafana 실행 방식이 바뀌지 않는다.
- Playwright 캡처 자동화는 기존 CLI/run-window 흐름을 유지해 evidence 생성 방식이 복잡해지지 않는다.
