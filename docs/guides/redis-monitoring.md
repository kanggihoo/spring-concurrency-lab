# Redis Monitoring Guide

Redis 관측은 Redisson Lock, Redis Lua, Redis command latency를 비교하기 위해 사용한다.

## Metrics

| Metric | Purpose |
|---|---|
| connected clients | Redis 연결 수 |
| command duration | Redis 명령 지연 |
| rejected connections | 연결 실패 |
| keyspace hits/misses | key 접근 특성 |

## Evidence

Redis 관련 evidence는 전략별 디렉터리에 저장한다.

```text
docs/evidence/05-redis-strategies/redisson-lock/
docs/evidence/05-redis-strategies/redis-lua/
```

## Notes

Redis 장애 대응의 본격 실험은 이 프로젝트의 핵심 범위가 아니다. 여기서는 DB 전략 대비 Redis 전략의 정합성, 처리량, 지연 시간, 불일치 위험을 중심으로 기록한다.
