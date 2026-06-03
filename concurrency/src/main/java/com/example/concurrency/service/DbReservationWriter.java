package com.example.concurrency.service;

import com.example.concurrency.domain.Reservation;
import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DbReservationWriter {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public DbReservationWriter(ConcertRepository concertRepository,
                               ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional
    public void reserveWithAtomicUpdate(Long concertId, Long userId) {
        int updatedRows = concertRepository.decreaseRemainingSeatsIfAvailable(concertId);
        if (updatedRows == 0) {
            throw new SoldOutException();
        }

        reservationRepository.save(new Reservation(concertId, userId));
    }
}
