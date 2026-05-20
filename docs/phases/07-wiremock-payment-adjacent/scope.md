# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

외부 결제 API 지연이 DB lock hold time, p99, 커넥션 풀에 미치는 영향을 맛보기로 검증한다.

## Target Scenarios

- DB lock 안에서 WireMock API 호출
- 짧은 트랜잭션 후 WireMock API 호출
- WireMock delay, 500 error, timeout

## Out of Scope

- 실제 PG 연동
- 결제 상태머신 전체 구현
- webhook 처리
- Kafka/Outbox
- 환불/정산

## Completion Gate

- [ ] WireMock 실험 runbook을 작성했다.
- [ ] lock 안/밖 외부 호출 결과를 비교했다.
- [ ] delay/error/timeout evidence를 저장했다.
- [ ] 결제 프로젝트에서 본격적으로 다룰 주제를 기록했다.
