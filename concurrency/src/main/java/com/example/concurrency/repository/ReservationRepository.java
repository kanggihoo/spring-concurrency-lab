package com.example.concurrency.repository;

import com.example.concurrency.domain.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Reservation 엔티티 저장소.
 * countByConcertId — 특정 콘서트의 예약 건수를 조회하여 정합성 검증에 사용.
 */
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    // 특정 콘서트에 대한 예약 수 카운트 (테스트 검증용)
    long countByConcertId(Long concertId); // SELECT COUNT(*) FROM reservation WHERE concert_id = ?;
}
