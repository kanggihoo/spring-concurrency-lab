package com.example.concurrency.service;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.OptimisticLockException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 예약 서비스 — Phase 2 베이스라인 (락 없음).
 * 여러 스레드가 동시에 같은 remainingSeats 값을 읽고 차감하므로 lost update가 발생한다.
 */
@Service
public class ReservationService {

    private static final int MAX_OPTIMISTIC_ATTEMPTS = 5;

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
    private final TransactionTemplate transactionTemplate;
    private final Counter optimisticRetryCounter;

    public ReservationService(ConcertRepository concertRepository,
                              ReservationRepository reservationRepository,
                              PlatformTransactionManager transactionManager,
                              MeterRegistry meterRegistry) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.optimisticRetryCounter = Counter.builder("reservation.optimistic.retry")
                .description("Optimistic lock retry attempts")
                .register(meterRegistry);
    }

    /**
     * 예약 처리 — 락 없이 수행.
     * Race Condition 발생 지점: findById → remainingSeats 체크 → 차감 사이에
     * 다른 스레드가 같은 remainingSeats 값을 읽어 중복 차감이 누락된다.
     */
    @Transactional
    public void reserve(Long concertId, Long userId) {
        // 1. find concert
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        // 2. check remaining seats
        if (concert.getRemainingSeats() <= 0) {
            throw new IllegalStateException("Sold out.");
        }

        // 3. decrease remaining seats — lost update can occur here
        concert.decreaseRemainingSeats();

        // 4. save reservation
        reservationRepository.save(new Reservation(concertId, userId));
    }

    @Transactional
    public void reserveWithPessimisticLock(Long concertId, Long userId) {
        Concert concert = concertRepository.findByIdWithPessimisticLock(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(concertId, userId));
    }

    public void reserveWithOptimisticLock(Long concertId, Long userId) {
        int attempts = 0;

        while (attempts < MAX_OPTIMISTIC_ATTEMPTS) {
            try {
                transactionTemplate.executeWithoutResult(status ->
                        reserveWithOptimisticLockOnce(concertId, userId));
                return;
            } catch (ObjectOptimisticLockingFailureException | OptimisticLockException e) {
                attempts++;
                optimisticRetryCounter.increment();
                if (attempts >= MAX_OPTIMISTIC_ATTEMPTS) {
                    throw new OptimisticLockRetryExhaustedException(attempts);
                }
            }
        }
    }

    private void reserveWithOptimisticLockOnce(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
