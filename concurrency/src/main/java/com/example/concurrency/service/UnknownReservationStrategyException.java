package com.example.concurrency.service;

public class UnknownReservationStrategyException extends RuntimeException {

    public UnknownReservationStrategyException(String strategyName) {
        super("Unknown reservation strategy: " + strategyName);
    }
}
