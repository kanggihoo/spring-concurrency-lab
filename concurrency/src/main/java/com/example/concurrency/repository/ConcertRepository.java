package com.example.concurrency.repository;

import com.example.concurrency.domain.Concert;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Concert 엔티티 저장소.
 */
public interface ConcertRepository extends JpaRepository<Concert, Long> {

    // 비관적 락 조회 — SELECT ... FOR UPDATE (다른 트랜잭션은 락 해제까지 대기)
    @Lock(LockModeType.PESSIMISTIC_WRITE) // 이게 무슨 설정이지? 
    @Query("SELECT c FROM Concert c WHERE c.id = :id") // 이건 또 뭐지?
    Optional<Concert> findByIdWithPessimisticLock(@Param("id") Long id);
}
