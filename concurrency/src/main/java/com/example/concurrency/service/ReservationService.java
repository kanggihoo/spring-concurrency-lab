package com.example.concurrency.service;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 예약 서비스 — Phase 3: 비관적 락 / 낙관적 락 동시성 처리.
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
     * 락 없는 예약 (Phase 2 베이스라인).
     * 동시 접근 시 Lost Update 발생 가능.
     */
    @Transactional
    public void reserve(Long concertId, Long userId) {
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        concert.decreaseStock();
        reservationRepository.save(new Reservation(concertId, userId));
    }

    /**
     * 비관적 락 예약 — SELECT FOR UPDATE로 row 잠금.
     * 다른 트랜잭션은 이 락이 풀릴 때까지 대기한다.
     */
    @Transactional
    public void reserveWithPessimisticLock(Long concertId, Long userId) {
        // 비관적 락으로 조회 — 다른 트랜잭션 대기
        Concert concert = concertRepository.findByIdWithPessimisticLock(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        concert.decreaseStock();
        reservationRepository.save(new Reservation(concertId, userId));
    }

    /**
     * 낙관적 락 예약 — @Version으로 충돌 감지, 충돌 시 자동 재시도.
     * maxAttempts=5, 재시도 간격 100ms.
     */
    @Retryable(
            includes = ObjectOptimisticLockingFailureException.class,
            maxRetries = 4,   // 최대 4회 재시도 (총 5회 시도)
            delay = 100       // 재시도 간격 100ms
    )
    @Transactional
    public void reserveWithOptimisticLock(Long concertId, Long userId) {
        // 일반 조회 — @Version으로 커밋 시점에 충돌 감지
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + concertId));

        concert.decreaseStock();
        reservationRepository.save(new Reservation(concertId, userId));
    }
}
