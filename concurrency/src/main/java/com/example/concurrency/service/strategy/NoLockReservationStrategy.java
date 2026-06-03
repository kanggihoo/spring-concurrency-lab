package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class NoLockReservationStrategy implements ReservationStrategy {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public NoLockReservationStrategy(ConcertRepository concertRepository,
                                     ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Override
    public String name() {
        return "no-lock";
    }

    @Override
    @Transactional
    public void reserve(ReservationCommand command) {
        Concert concert = concertRepository.findById(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        if (concert.getRemainingSeats() <= 0) {
            throw new SoldOutException();
        }

        concert.decreaseRemainingSeats();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
