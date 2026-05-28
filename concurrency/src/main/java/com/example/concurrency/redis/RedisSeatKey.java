package com.example.concurrency.redis;

public final class RedisSeatKey {

    private RedisSeatKey() {
    }

    public static String remainingSeats(Long concertId) {
        return "concert:%d:remaining-seats".formatted(concertId);
    }

    public static String lock(Long concertId) {
        return "concert:%d:reservation-lock".formatted(concertId);
    }
}
