package com.example.concurrency.repository;

import com.example.concurrency.domain.Concert;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Concert 엔티티 저장소 — 기본 CRUD 제공.
 */
public interface ConcertRepository extends JpaRepository<Concert, Long> {
}
