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

    /**
     * 비관적 락(Pessimistic Write Lock)을 활용한 Concert 조회
     * 
     * SQL 실행 시 'SELECT ... FOR UPDATE' 구문이 추가되며, 
     * 트랜잭션이 종료(Commit/Rollback)될 때까지 해당 데이터 로우(Row)에 대한 
     * 다른 트랜잭션의 읽기 및 쓰기 접근을 모두 차단(Blocking)합니다.
     * 
     * @param id 조회할 콘서트의 ID
     * @return 비관적 락이 적용된 Concert 엔티티 (Optional)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE) // 데이터베이스 수준의 배타적 락(Exclusive Lock) 설정
    @Query("SELECT c FROM Concert c WHERE c.id = :id") // JPQL을 사용하여 조회 대상을 명시적으로 지정
    Optional<Concert> findByIdWithPessimisticLock(@Param("id") Long id);
}
