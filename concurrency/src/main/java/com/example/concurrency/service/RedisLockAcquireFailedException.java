package com.example.concurrency.service;

public class RedisLockAcquireFailedException extends RuntimeException {

    public RedisLockAcquireFailedException(Long concertId) {
        super("Redis lock acquire failed. concertId=" + concertId);
    }
}
