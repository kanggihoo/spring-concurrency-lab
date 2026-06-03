package com.example.concurrency.service.strategy;

import com.example.concurrency.service.ReservationCommand;

public interface ReservationStrategy {

    String name();

    void reserve(ReservationCommand command);
}
