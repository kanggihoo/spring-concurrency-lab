package com.example.concurrency.service;

public class RedisReservationException extends RuntimeException {

    public RedisReservationException(String message, Throwable cause) {
        super(message, cause);
    }
}
