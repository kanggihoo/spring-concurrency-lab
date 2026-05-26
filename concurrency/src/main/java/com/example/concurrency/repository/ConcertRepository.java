package com.example.concurrency.repository;

import com.example.concurrency.domain.Concert;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ConcertRepository extends JpaRepository<Concert, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Concert c where c.id = :id")
    Optional<Concert> findByIdWithPessimisticLock(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Concert c
               set c.remainingSeats = c.remainingSeats - 1
             where c.id = :id
               and c.remainingSeats > 0
            """)
    int decreaseRemainingSeatsIfAvailable(@Param("id") Long id);
}
