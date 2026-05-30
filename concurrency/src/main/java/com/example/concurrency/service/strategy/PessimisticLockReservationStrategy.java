package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationCommand;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PessimisticLockReservationStrategy implements ReservationStrategy {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public PessimisticLockReservationStrategy(ConcertRepository concertRepository,
                                              ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Override
    public String name() {
        return "pessimistic";
    }

    @Override
    @Transactional
    public void reserve(ReservationCommand command) {
        Concert concert = concertRepository.findByIdWithPessimisticLock(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
