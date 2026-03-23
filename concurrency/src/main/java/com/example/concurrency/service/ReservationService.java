package com.example.concurrency.service;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 예약 서비스 — Phase 2 베이스라인 (락 없음).
 * 여러 스레드가 동시에 같은 stock 값을 읽고 차감하므로 lost update가 발생한다.
 */
@Service
public class ReservationService {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public ReservationService(ConcertRepository concertRepository,
                              ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    /**
     * 예약 처리 — 락 없이 수행.
     * Race Condition 발생 지점: findById → stock 체크 → 차감 사이에
     * 다른 스레드가 같은 stock 값을 읽어 중복 차감이 누락된다.
     */
    @Transactional
    public void reserve(Long concertId, Long userId) {
        // 1. find concert
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        // 2. check stock
        if (concert.getStock() <= 0) {
            throw new IllegalStateException("Sold out.");
        }

        // 3. decrease stock — lost update can occur here
        concert.decreaseStock(); // JPA의 변경 감지(Dirty Checking)으로 인해 값변경시 업데이트 SQL 진행.

        // 4. save reservation
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
