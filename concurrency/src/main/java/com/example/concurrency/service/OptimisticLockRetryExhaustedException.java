package com.example.concurrency.service;

public class OptimisticLockRetryExhaustedException extends RuntimeException {

    public OptimisticLockRetryExhaustedException(int attempts) {
        super("Optimistic lock retry exhausted. attempts=" + attempts);
    }
}
