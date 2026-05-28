package com.example.concurrency.controller;

import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.RedisLockAcquireFailedException;
import com.example.concurrency.service.RedisReservationException;
import com.example.concurrency.service.ReservationService;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Reservation API — POST /api/reservations
 * 200 OK on success, 409 CONFLICT when sold out.
 */
@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> reserve(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserve(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (IllegalStateException e) {
            // sold out
            return ResponseEntity.status(409).body(Map.of("status", "sold_out"));
        }
    }

    @PostMapping("/pessimistic")
    public ResponseEntity<Map<String, String>> reserveWithPessimisticLock(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithPessimisticLock(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (PessimisticLockingFailureException | QueryTimeoutException e) {
            return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(Map.of("status", "lock_timeout"));
        }
    }

    @PostMapping("/optimistic")
    public ResponseEntity<Map<String, String>> reserveWithOptimisticLock(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithOptimisticLock(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (OptimisticLockRetryExhaustedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "optimistic_lock_exhausted"));
        }
    }

    @PostMapping("/atomic")
    public ResponseEntity<Map<String, String>> reserveWithAtomicUpdate(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithAtomicUpdate(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        }
    }

    @PostMapping("/redisson")
    public ResponseEntity<Map<String, String>> reserveWithRedissonLock(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithRedissonLock(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (RedisLockAcquireFailedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "lock_acquire_failed"));
        }
    }

    @PostMapping("/redis-lua")
    public ResponseEntity<Map<String, String>> reserveWithRedisLua(@RequestBody ReservationRequest request) {
        try {
            reservationService.reserveWithRedisLua(request.concertId(), request.userId());
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (RedisReservationException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "redis_db_sync_failed"));
        }
    }
}
