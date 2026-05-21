# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. 테스트 전 상태를 초기화한다.
2. 같은 `concertId`, `userId`로 중복 요청을 보낸다.
3. unique constraint 차단 결과를 저장한다.
4. 같은 idempotency key로 반복 요청을 보낸다.
5. 처리 결과와 응답 정책을 기록한다.
6. `report.md`에 결제 프로젝트로 이어질 내용을 정리한다.

## Related Guides

- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
