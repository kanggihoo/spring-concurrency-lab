package com.example.concurrency.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RedisSeatStore {

    private static final String DECREMENT_IF_AVAILABLE_SCRIPT = """
            local seats = tonumber(redis.call('GET', KEYS[1]))
            if seats == nil or seats <= 0 then
                return 0
            end
            redis.call('DECR', KEYS[1])
            return 1
            """;

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

    public boolean decrementIfAvailable(Long concertId) {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>(DECREMENT_IF_AVAILABLE_SCRIPT, Long.class);
        Long result = redisTemplate.execute(script, List.of(RedisSeatKey.remainingSeats(concertId)));
        return result != null && result == 1L;
    }

    public void compensateDecrement(Long concertId) {
        redisTemplate.opsForValue().increment(RedisSeatKey.remainingSeats(concertId));
    }
}
