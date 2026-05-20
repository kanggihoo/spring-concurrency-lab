# WireMock Guide

WireMock은 결제 프로젝트의 사전 맛보기로, 외부 PG API 지연이 동시성 처리에 미치는 영향을 실험하기 위해 사용한다.

## Target Scenarios

- normal response
- delayed response
- 500 error
- timeout

## Experiment Focus

비교 대상은 결제 도메인 완성이 아니라 외부 API 호출 위치다.

```text
DB lock inside external call
DB lock outside external call
```

## Evidence

```text
docs/evidence/07-wiremock-payment-adjacent/lock-inside-external-call/
docs/evidence/07-wiremock-payment-adjacent/lock-outside-external-call/
```

## Handoff

Webhook, PG 승인/취소, Kafka/Outbox, 환불/정산은 결제 프로젝트에서 본격적으로 다룬다.
