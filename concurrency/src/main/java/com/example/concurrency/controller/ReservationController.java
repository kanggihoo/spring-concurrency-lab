package com.example.concurrency.controller;

import com.example.concurrency.service.ReservationService;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 예약 API — 락 방식별 엔드포인트 제공.
 */
@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    // 락 없는 예약 (Phase 2 베이스라인)
    @PostMapping
    public ResponseEntity<Map<String, String>> reserve(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserve(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "server_error"));
        }
    }

    // 비관적 락 예약 (Phase 3)
    @PostMapping("/pessimistic")
    public ResponseEntity<Map<String, String>> reserveWithPessimisticLock(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithPessimisticLock(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (PessimisticLockingFailureException | QueryTimeoutException e) {
            return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(Map.of("status", "lock_timeout"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "server_error"));
        }
    }

    // 낙관적 락 예약 (Phase 3)
    @PostMapping("/optimistic")
    public ResponseEntity<Map<String, String>> reserveWithOptimisticLock(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithOptimisticLock(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (ObjectOptimisticLockingFailureException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "optimistic_lock_exhausted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "server_error"));
        }
    }
}
