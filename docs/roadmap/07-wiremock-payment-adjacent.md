# Phase 7. WireMock Payment-Adjacent Experiment

## Goal

Fake PG 역할의 WireMock을 사용해 외부 API 지연이 DB 락, 트랜잭션, 커넥션 풀에 미치는 영향을 맛보기로 검증한다.

## Scenarios

- 외부 API 호출을 DB lock 안에 넣은 나쁜 케이스
- 짧은 트랜잭션 후 외부 API를 호출하는 분리 케이스
- WireMock delay, 500 error, timeout 응답

## Key Questions

- 외부 API 지연이 lock hold time과 p99를 얼마나 악화시키는가?
- 트랜잭션 밖으로 외부 호출을 분리하면 어떤 지표가 개선되는가?
- 결제 프로젝트에서 본격적으로 다뤄야 할 장애 대응 주제는 무엇인가?

## Completion Criteria

- WireMock 실험 runbook 작성
- delay별 k6 결과 저장
- lock 안/밖 호출 방식 비교표 작성
- `docs/phases/07-wiremock-payment-adjacent/report.md`에 결제 프로젝트 이관 주제 기록

## Phase Docs

- [Phase Hub](../phases/07-wiremock-payment-adjacent/README.md)
