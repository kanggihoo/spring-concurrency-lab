package com.example.concurrency.service.strategy;

import com.example.concurrency.service.DbReservationWriter;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;

@Component
public class AtomicUpdateReservationStrategy implements ReservationStrategy {

    private final DbReservationWriter dbReservationWriter;

    public AtomicUpdateReservationStrategy(DbReservationWriter dbReservationWriter) {
        this.dbReservationWriter = dbReservationWriter;
    }

    @Override
    public String name() {
        return "atomic";
    }

    @Override
    public void reserve(ReservationCommand command) {
        dbReservationWriter.reserveWithAtomicUpdate(command.concertId(), command.userId());
    }
}
