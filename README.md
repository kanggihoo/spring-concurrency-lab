# 🚀 Spring Concurrency Lab

> **백엔드 역량 강화를 위한 동시성 문제 해결 및 성능 측정 벤치마킹 프로젝트**

이 프로젝트는 Spring Boot 기반 아키텍처에서 발생하는 동시성 충돌을 해결하기 위한 다양한 전략(DB Lock, Redis Distributed Lock 등)을 실습하고, **k6 + Prometheus + Grafana** 구성을 통해 성능 수치를 객관적으로 지표화하는 것을 목표로 합니다.

---

## 🛠️ Tech Stack & Infrastructure

- **Backend**: Spring Boot 4.0.3, Java 21, Spring Actuator
- **Database**: PostgreSQL 17
- **Load Testing**: k6 (Open source load testing tool)
- **Monitoring**: Prometheus, Grafana
- **Containerization**: Docker Compose

## 📊 System Architecture

1.  **Spring Boot**: 동시성 제어 로직 구현 및 Micrometer를 통한 메트릭 노출
2.  **k6**: 대상 API에 동시 부하(VUs) 발생 (Prometheus Remote Write 연동)
3.  **Prometheus**: k6 및 Spring Boot의 메트릭 데이터를 실시간 수집/보관
4.  **Grafana**: 수집된 데이터를 차트화하여 지연 시간(Latency) 및 TPS 분석

## 🚀 Quick Start (인프라 실행)

```bash
# 1. 모니터링 인프라 실행 (Prometheus, Grafana, DB) - 백그라운드 구동
docker compose up -d

# 2. k6 부하 테스트 시뮬레이션 (on-demand)
# (주의: 로컬 Spring Boot 서버가 8080 포트에서 실행 중이어야 합니다)
docker compose --profile test up k6
```

## 📖 상세 문서 (Documentation)

자세한 구축 과정과 분석 결과는 아래 링크를 참조하세요:

- [**모니터링 구축 요약 & 로그 해석 가이드**](./docs/monitring-setup-summary.md)
  - Prometheus 연결, Grafana 대시보드 변수 설정, k6 로그 읽는 법
- [**성능 테스트 계획서**](./docs/PLAN-k6-load-testing.md)
  - k6 시나리오 및 주요 태스크 로드맵
- [**k6 설치 및 로컬 설정 가이드**](./settings.md)
  - k6 설치 방법 및 로컬 실행 명령어 모음

---

## 📅 Roadmap (진행 단계)

- [x] 모니터링 인프라 구축 (Spring Boot + Prometheus + Grafana)
- [x] k6 로드 테스트 연동 및 시각화 검증
- [ ] 단일 모듈 예약 시스템 API 설계 (Ticket & Inventory)
- [ ] 동시성 충돌 시나리오 구현
- [ ] DB Lock (Optimistic/Pessimistic) 적용 및 벤치마킹
- [ ] Redis 분산 락(Redisson) 적용 및 성능 비교 분석
