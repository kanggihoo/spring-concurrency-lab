# 0002. Adopt Makefile Command Interface

## Status

Accepted

## Context

이 프로젝트는 Spring Boot 서버 실행, Docker Compose 기반 관측 도구 실행, k6 부하 테스트, Grafana dashboard 생성/캡처, 이미지 stitch 같은 반복 작업을 포함한다.

기존 구현은 `k6/run.sh`, `package.json` scripts, `scripts/` 파일에 나뉘어 있었다. 기능별 구현 파일을 유지하더라도 사람이 매번 파일명을 찾아 실행하면 phase 간 실행법과 evidence 위치가 흔들리기 쉽다.

## Decision

루트 `Makefile`을 공식 반복 실행 인터페이스로 채택한다.

- 사람과 agent는 먼저 `make help`를 확인한다.
- 문서의 반복 실행 예시는 기본적으로 `make ...` 형식으로 작성한다.
- `package.json` scripts는 Node 기반 내부 작업 이름으로 유지한다.
- `scripts/`와 `k6/` 파일은 실제 구현 파일로 유지하고, 이번 변경에서는 이동하지 않는다.
- 명령 설명은 `docs/guides/commands.md`에 둔다.

## Consequences

장점:

- 반복 실행 명령이 프로젝트 루트의 단일 인터페이스로 모인다.
- phase 문서와 evidence 수집 절차를 같은 명령 형식으로 안내할 수 있다.
- 기존 스크립트 파일 이동 없이 점진적으로 표준화할 수 있다.

주의점:

- 현재 repo는 evidence/phase 디렉토리 이름으로 `02-no-lock-baseline`을 사용하고, metric label에는 `phase-02`를 사용한다. Makefile은 이를 `PHASE`와 `GRAFANA_PHASE`로 분리한다.
- 스크립트 파일 구조 개편은 별도 변경으로 처리한다.
