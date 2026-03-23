-- 모니터링 전용 유저 생성
CREATE USER prometheus WITH PASSWORD 'prometheus';

-- pg_stat 뷰 조회 권한 부여 (PostgreSQL 10+)
GRANT pg_monitor TO prometheus;

-- pg_stat_statements 활성화 (슬로우 쿼리 추적용)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
