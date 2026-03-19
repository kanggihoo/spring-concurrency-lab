# Spring Boot Monitoring Setup Summary

이 문서는 지금까지 진행한 Spring Boot ↔ Prometheus ↔ Grafana 연동 및 모니터링 구축 작업의 핵심 내용을 정리한 것입니다. 추후 학습 후 다시 작업을 이어나가실 때 참고하시기 바랍니다.

## 1. 현재까지 완료된 작업 (진행 상황)

### ① Spring Boot 설정 (`application.yml` 및 `build.gradle`)

- **의존성 추가**: `spring-boot-starter-actuator`, `micrometer-registry-prometheus` 의존성을 통해 Spring Boot 앱이 JVM 및 애플리케이션 메트릭을 수집하도록 설정했습니다.
- **엔드포인트 노출**: `application.yml`에서 Actuator의 `prometheus` 엔드포인트를 노출시켰습니다.
- **메트릭 태그 추가**: 메트릭을 분류하기 쉽도록 `application: concurrency` 태그를 전역으로 추가했습니다.
  - 이를 통해 `http://localhost:8080/actuator/prometheus`로 접속하면 수집된 메트릭 데이터를 확인할 수 있습니다.

### ② Prometheus 설정 (`docker-compose.yml` & `prometheus.yml`)

- **Docker Compose**: Prometheus 컨테이너를 도커로 띄우고, 로컬 설정 파일(`prometheus.yml`)을 마운트하여 구동했습니다.
- **Scrape Config**: `prometheus.yml`에서 로컬 호스트의 Spring Boot 앱(포트 8080)을 `host.docker.internal:8080`을 통해 주기적(5초/10초 등)으로 긁어오도록(Scrape) 설정했습니다.

### ③ Grafana 로컬 연동 및 대시보드 불러오기

- **Grafana 실행**: Docker Compose를 통해 Grafana(포트 3000)를 구동했습니다.
- **Data Source 연동**: Grafana 내에서 Prometheus를 Data Source로 추가하고 연결 테스트를 완료했습니다.
- **JVM Micrometer 대시보드 임포트**: Spring Boot 기본 모니터링을 위해 기존에 만들어진 템플릿(JVM Micrometer dashboard)을 불러왔습니다.

### ④ Grafana Dashboard 환경변수(Variable) 트러블슈팅

- **문제 현상**: 대시보드를 임포트한 직후 매번 'Query Options'에서 수동으로 Refresh를 해야만 그래프가 나타나는 현상.
- **원인 및 해결 방향**:
  1. Grafana 변수(`$application`, `$instance`)가 Prometheus의 실제 메트릭 데이터와 매핑되지 않거나,
  2. 대시보드 로드 시 자동 갱신(`Refresh on dashboard load`) 설정이 안 되어 있거나,
  3. 현재 선택된 정상 상태 값을 **"대시보드 기본값(Default)"**으로 저장하지 않아서 발생합니다.
- **조치 사항**: Settings -> Variables 항목에서 각 변수의 Query를 `label_values(...)` 형태로 바로잡고, 정상 작동하는 상태에서 `Save current variable values as dashboard default`에 꼭 체크한 후 대시보드를 덮어써서 문제를 해결할 수 있습니다.

---

## 2. 향후 진행할 다음 단계 (Next Steps)

프로메테우스와 그라파나의 기본 작동 방식 및 PromQL, 대시보드 변수(Variable) 시스템에 익숙해지신 후, 다음 단계로 넘어갈 수 있습니다.

1. **대시보드 커스터마이징 및 고도화**
   - 현재 임포트한 대시보드 외에, 내 애플리케이션(예: 예약 시스템)에 특화된 커스텀 메트릭 표시
   - 알람(Alerting) 기능 설정 (서버 다운, CPU 초과 등)

2. **k6 성능 테스트 지표 연동**
   - 추후 Docker로 k6 성능 테스트 환경 구축
   - k6의 테스트 결과를 Prometheus를 통해 수집하고 Grafana에서 시각화하여 TPS, 응답 지연(Latency) 등을 분석

---

**💡 학습 조언**:

- **Prometheus**: 메트릭이 수집되는 포맷(Key-Value 형태)과 데이터를 조회하는 쿼리 언어인 **PromQL**의 기본 형태를 학습해 보세요.
- **Grafana**: **Variables** (변수) 시스템과 대시보드 **패널(Panel) 편집** 방식을 한번 훑어보시면, 템플릿을 수정하거나 새로 그릴 때 큰 도움이 됩니다.
