package com.example.concurrency.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisSeatStore {

    private final StringRedisTemplate redisTemplate;

    public RedisSeatStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void initializeRemainingSeats(Long concertId, int remainingSeats) {
        redisTemplate.opsForValue().set(RedisSeatKey.remainingSeats(concertId), Integer.toString(remainingSeats));
    }

    public Integer getRemainingSeats(Long concertId) {
        String value = redisTemplate.opsForValue().get(RedisSeatKey.remainingSeats(concertId));
        if (value == null) {
            return null;
        }
        return Integer.parseInt(value);
    }

    public void compensateDecrement(Long concertId) {
        redisTemplate.opsForValue().increment(RedisSeatKey.remainingSeats(concertId));
    }
}
