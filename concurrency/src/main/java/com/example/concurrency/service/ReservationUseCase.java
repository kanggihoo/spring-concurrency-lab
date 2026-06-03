package com.example.concurrency.service;

import org.springframework.stereotype.Service;

@Service
public class ReservationUseCase {

    private final ReservationStrategyRegistry reservationStrategyRegistry;

    public ReservationUseCase(ReservationStrategyRegistry reservationStrategyRegistry) {
        this.reservationStrategyRegistry = reservationStrategyRegistry;
    }

    public void reserve(String strategyName, ReservationCommand command) {
        reservationStrategyRegistry.get(strategyName).reserve(command);
    }
}
