package com.example.concurrency.service;

import com.example.concurrency.service.strategy.ReservationStrategy;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class ReservationStrategyRegistry {

    private final Map<String, ReservationStrategy> strategies;

    public ReservationStrategyRegistry(List<ReservationStrategy> strategies) {
        Map<String, ReservationStrategy> collected = new LinkedHashMap<>();
        for (ReservationStrategy strategy : strategies) {
            ReservationStrategy previous = collected.put(strategy.name(), strategy);
            if (previous != null) {
                throw new IllegalStateException("Duplicate reservation strategy: " + strategy.name());
            }
        }
        this.strategies = Collections.unmodifiableMap(collected);
    }

    public ReservationStrategy get(String name) {
        ReservationStrategy strategy = strategies.get(name);
        if (strategy == null) {
            throw new UnknownReservationStrategyException(name);
        }
        return strategy;
    }

    public Set<String> names() {
        return strategies.keySet();
    }
}
