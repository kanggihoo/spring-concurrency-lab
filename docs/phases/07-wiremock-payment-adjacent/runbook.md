# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. WireMock Fake PG를 실행한다.
2. 정상 응답, delay, 500 error, timeout stub을 준비한다.
3. DB lock 안에서 외부 API를 호출하는 케이스를 실행한다.
4. 트랜잭션 밖에서 외부 API를 호출하는 케이스를 실행한다.
5. 같은 k6 조건에서 두 케이스를 비교한다.
6. lock wait, Hikari pending, p99 지표를 기록한다.
7. 결제 프로젝트로 넘길 장애 대응 주제를 `report.md`에 기록한다.

## Related Guides

- [WireMock](../../guides/wiremock.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
