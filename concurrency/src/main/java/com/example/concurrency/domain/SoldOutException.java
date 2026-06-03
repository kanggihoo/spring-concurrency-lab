package com.example.concurrency.domain;

public class SoldOutException extends RuntimeException {

    public SoldOutException() {
        super("Sold out.");
    }
}
