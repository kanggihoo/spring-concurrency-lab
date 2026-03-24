-- Concert & Reservation schema for Phase 3 (DB Lock)

CREATE TABLE IF NOT EXISTS concert (
    id      BIGSERIAL PRIMARY KEY,
    title   VARCHAR(255) NOT NULL,
    stock   INT NOT NULL DEFAULT 100,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reservation (
    id         BIGSERIAL PRIMARY KEY,
    concert_id BIGINT NOT NULL REFERENCES concert(id),
    user_id    BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 기존 테스트 코드용 데이터 유지 (ID: 1)
INSERT INTO concert (title, stock, version) VALUES ('Concert A', 100, 0);


-- K6 부하 테스트용 전용 데이터 추가 (ID: 2, 3, 4)
-- 재고를 10,000개 정도로 넉넉히 잡아야 '재고 부족'이 아닌 '경합/성능'을 볼 수 있습니다.
INSERT INTO concert (title, stock, version) VALUES ('K6 No Lock', 10000, 0);       -- id: 2
INSERT INTO concert (title, stock, version) VALUES ('K6 Pessimistic', 10000, 0); -- id: 3
INSERT INTO concert (title, stock, version) VALUES ('K6 Optimistic', 10000, 0);  -- id: 4