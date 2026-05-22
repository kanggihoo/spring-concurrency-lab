# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. Spring Boot 애플리케이션을 실행한다.
2. `POST /api/test/reset`으로 상태를 초기화한다.
3. no-lock 동시성 테스트를 실행한다.
4. k6 baseline 시나리오를 실행한다.
5. 정합성 검증 SQL을 실행한다.
6. 결과를 `docs/evidence/02-no-lock-baseline/`에 저장한다.
7. `report.md`에 측정값과 결론을 기록한다.
8. Generate Grafana dashboards.

   ```bash
   npm run grafana:generate
   ```

9. Save SQL consistency evidence.

   ```bash
   docker compose exec -T postgres psql -U user -d reservation \
     < scripts/sql/phase2-consistency-check.sql \
     > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
   ```

10. Capture Grafana dashboard parts.

   ```bash
   npm run grafana:capture:phase2
   ```

## Related Guides

- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
