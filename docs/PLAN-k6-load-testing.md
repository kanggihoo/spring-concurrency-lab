# k6 Load Testing & Grafana Integration

## Overview
Spring Boot 서버의 동시성 문제 해결 및 성능 측정을 위해 k6 부하 테스트 환경을 구축하고, 발생한 메트릭 지표를 기존의 Prometheus + Grafana 모니터링 생태계에 연동하여 시각화합니다.

## Project Type
BACKEND / INFRASTRUCTURE

## Success Criteria
- k6 스크립트를 통해 대상 Spring Boot 서버에 실제 부하(Virtual Users)를 안정적으로 가할 수 있다.
- k6에서 발생한 부하 통계 지표(VUs, HTTP Request duration, Errors 등)가 Prometheus에 성공적으로 적재된다.
- Grafana에서 k6 전용 대시보드를 통해 부하 테스트 결과를 다른 모니터링 지표와 함께 상관분석 할 수 있다.

## Tech Stack
- **Load Testing**: k6
- **Metrics Storage**: Prometheus (k6 experimental-prometheus-rw 모듈 등 활용 예정)
- **Visualization**: Grafana

## Task Breakdown
- [ ] **Task 1: k6 부하 테스트 스크립트 작성** 
  - **Agent/Skill**: `backend-specialist` / `clean-code`
  - **Action**: 동시성 제어가 필요한 Spring Boot 서버의 핵심 API 엔드포인트(예: 티켓 예매, 재고 차감 등)를 대상으로 동작하는 `script.js` 생성.
  - **Verify**: `docker run --rm -v ${PWD}:/scripts grafana/k6 run /scripts/script.js` 실행 시 터미널 결과창에 로컬 대상 부하 테스트 결과가 올바르게 나오는지 확인.
  
- [ ] **Task 2: k6 - Prometheus 메트릭 수집 연동**
  - **Agent**: `devops-engineer`
  - **Action**: `docker-compose.yml` 또는 실행 명령어를 수정하여, k6가 테스트 중 생산하는 지표를 Prometheus의 Remote Write 엔드포인트로 노출/푸시 하도록 통합 구성. Prometheus 시작 시 `--web.enable-remote-write` 커맨드라인 옵션 추가.
  - **Verify**: k6 테스트가 돌아갈 때 프로메테우스 웹 화면(또는 쿼리)에서 `k6_` 접두사가 붙은 메트릭 조회가 가능한지 확인.

- [ ] **Task 3: Grafana 대시보드 추가 및 연결**
  - **Agent**: `devops-engineer` 
  - **Action**: Grafana에서 k6 전용 대시보드 템플릿(예: ID 19665 또는 10660 등)을 추가하고, 현재 Prometheus 데이터소스를 연결한 후 변수(Variables)를 고도화하여 갱신 문제 방지.
  - **Verify**: 테스트를 트리거한 시점에 K6 대시보드 상에서 실시간으로 지표(TPS, Latency 등)가 들어오는지 시각적으로 확인.

- [ ] **Task 4: 동시성 환경 검증 및 결과 분석**
  - **Agent/Skill**: `backend-specialist` / `performance-profiling`
  - **Action**: 실제 서비스 부하를 가정한 테스트(예: 1,000 VUs로 특정 시간 지속 등)를 실행하여, 로직의 Race Condition이나 응답 병목이 발생하는지 확인하고 Grafana로 증명.
  - **Verify**: 테스트 결과를 바탕으로 병목이나 오작동(데이터 정합성 등) 내역이 수치와 함께 도출되는지 확인.

## Phase X: Verification
- [ ] Prometheus의 `enable-remote-write` 옵션이 적용되었는지 확인.
- [ ] 컨테이너 네트워크 간에 포트가 정상 매핑되어 데이터가 전송되는지 확인.
- [ ] Socratic Gate (API 상세 설정, 목표 수치 결정 등) 완료 및 반영.
