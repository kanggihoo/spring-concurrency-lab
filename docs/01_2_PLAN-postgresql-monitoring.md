# Project Plan: PostgreSQL Monitoring Setup

## 1. Overview

k6 부하 테스트 시 PostgreSQL의 상태(커넥션, 트랜잭션, 캐시 히트율, 데드락 등)를 상세히 모니터링하기 위해 `postgres_exporter`를 도입하고, Prometheus를 통해 수집하여 Grafana에서 시각화합니다.

## 2. Project Type

**BACKEND**

## 3. Success Criteria

- [x] PostgreSQL 컨테이너에 모니터링 전용 유저 및 설정(`pg_stat_statements` 등)이 정상 적용된다.
- [x] `postgres_exporter` 컨테이너가 정상적으로 실행되어 DB 메트릭을 수집한다.
- [x] Prometheus가 `postgres_exporter`의 `/metrics` 엔드포인트를 지정된 간격으로 스크랩한다.
- [ ] Grafana에서 PostgreSQL 전용 대시보드(ID: 9628 등) 또는 Overview 대시보드에 메트릭이 정상 노출된다.

## 4. Tech Stack

- **PostgreSQL**: 대상 데이터베이스
- **postgres_exporter**: PostgreSQL의 `pg_stat_*` 뷰를 조회하여 Prometheus 포맷으로 노출
- **Prometheus**: 메트릭 수집 및 시계열 데이터 저장
- **Grafana**: 지표 시각화 대시보드

## 5. File Structure

```
├── postgres/
│   ├── init/
│   │   └── 01_monitoring.sql      # 모니터링 유저 생성 및 권한 부여
│   └── postgresql.conf            # pg_stat_statements 등 PostgreSQL 설정
├── docker-compose.yml             # postgres_exporter 컨테이너 추가
└── prometheus/
    └── prometheus.yml             # postgres_exporter 스크랩 타겟 추가
```

## 6. Task Breakdown

### Task 1: PostgreSQL 초기화 스크립트 작성

- **Agent**: `database-architect`
- **Skills**: `database-design`
- **Priority**: P0
- **INPUT**: `docs/K6 부하테스트 시 PostgreSQL 모니터링 가이드.md`의 초기화 스크립트
- **OUTPUT**: `postgres/init/01_monitoring.sql`
- **VERIFY**: 스크립트 작성 확인 및 PostgreSQL 컨테이너 기동 시 정상 실행되는지 확인

### Task 2: PostgreSQL 설정 파일 추가

- **Agent**: `database-architect`
- **Skills**: `database-design`
- **Priority**: P0
- **INPUT**: `pg_stat_statements` 활성화를 위한 설정 정보
- **OUTPUT**: `postgres/postgresql.conf`
- **VERIFY**: 파일 생성 확인

### Task 3: Postgres Exporter 도커 설정 추가

- **Agent**: `backend-specialist` (또는 `devops-engineer` 성격)
- **Skills**: `server-management`
- **Priority**: P1
- **Dependencies**: Task 1, Task 2
- **INPUT**: 기존 `docker-compose.yml`
- **OUTPUT**: `docker-compose.yml`에 `postgres_exporter` 서비스 추가 및 `postgres` 설정 변경
- **VERIFY**: `docker-compose config` 명령어로 YAML 문법 확인

### Task 4: Prometheus 스크랩 대상 추가

- **Agent**: `backend-specialist`
- **Skills**: `server-management`
- **Priority**: P1
- **Dependencies**: Task 3
- **INPUT**: 기존 `prometheus/prometheus.yml`
- **OUTPUT**: `prometheus.yml`의 `scrape_configs`에 `postgres_exporter` 타겟 추가
- **VERIFY**: Prometheus 환경 설정 정상 여부 확인

### Task 5: Grafana 대시보드 연동 설정

- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`
- **Priority**: P2
- **Dependencies**: Task 4
- **INPUT**: Grafana
- **OUTPUT**: Grafana 대시보드(ID 9628 또는 직접 구성) 가이드 제공
- **VERIFY**: 수집된 메트릭 시각화

## 7. Phase X: Verification

- [x] `docker compose up -d` 후 모든 컨테이너(`postgres`, `postgres_exporter`, `prometheus`, `grafana`)가 정상 실행 중인지 확인
- [x] `http://localhost:9187/metrics` 에서 메트릭 정상 노출 확인
- [x] Prometheus Targets (`http://localhost:9090/targets`)에서 `postgres_exporter` 상태가 UP인지 확인
- [x] `docs/PLAN-postgresql-monitoring.md` 작성 완료

# 📊 PostgreSQL Monitoring Plan & Status

## ✅ Task Status: COMPLETED 🥳

| Task                         | Status       | Note                                                     |
| :--------------------------- | :----------- | :------------------------------------------------------- |
| **Exporter Configuration**   | COMPLETED ✅ | `postgres_exporter` added to docker-compose              |
| **PostgreSQL Settings**      | COMPLETED ✅ | `pg_stat_statements` enabled & tracking set              |
| **SQL Init Fix**             | COMPLETED ✅ | Fixed `init.sql` folder issue, user `prometheus` created |
| **Scrape Configuration**     | COMPLETED ✅ | Prometheus job `postgres` is in `UP` state               |
| **Healthcheck & Dependency** | COMPLETED ✅ | `service_healthy` condition added for startup            |
| **Grafana Visualization**    | VERIFIED 📈  | Metrics (e.g., `numbackends`) are available via Exporter |

---

## 🛠️ Root Cause Found & Fixed (Post-Mortem)

- **ISSUE**: `postgres_exporter` failed with `Role "prometheus" does not exist`.
- **CAUSE**: `./init.sql` was accidentally created as a **directory** instead of a file. This caused the PostgreSQL initialization engine to skip ALL scripts in `/docker-entrypoint-initdb.d/`.
- **SOLUTION**:
  1. Deleted `init.sql` directory.
  2. Created `init.sql` as a file.
  3. Performed `docker compose down -v` to force a clean re-initialization.
  4. Added `healthcheck` to ensure the DB is ready before the Exporter connects.

## 🚀 Next Step: K6 Load Testing

Now that the monitoring pipeline is stable, you can proceed with:

- `docs/01_1_PLAN-k6-load-testing.md`
- Run your K6 scripts and observe the PostgreSQL behavior in Grafana!

---

_Updated on: 2026-03-20 15:15 KST_
