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

-- Initial data: one concert with 100 seats
INSERT INTO concert (title, stock, version) VALUES ('Concert A', 100, 0);
