package com.example.concurrency.controller;

import com.example.concurrency.domain.SoldOutException;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.ReservationCommand;
import com.example.concurrency.service.ReservationUseCase;
import com.example.concurrency.service.UnknownReservationStrategyException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
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

    private final ReservationUseCase reservationUseCase;

    public ReservationController(ReservationUseCase reservationUseCase) {
        this.reservationUseCase = reservationUseCase;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> reserveDefault(@RequestBody ReservationRequest request) {
        return reserveWithStrategy("no-lock", request);
    }

    @PostMapping("/{strategy}")
    public ResponseEntity<Map<String, String>> reserveByStrategy(@PathVariable String strategy,
                                                                @RequestBody ReservationRequest request) {
        return reserveWithStrategy(strategy, request);
    }

    private ResponseEntity<Map<String, String>> reserveWithStrategy(String strategy,
                                                                  ReservationRequest request) {
        try {
            reservationUseCase.reserve(strategy, new ReservationCommand(request.concertId(), request.userId()));
            return ResponseEntity.ok(Map.of("status", "reserved"));
        } catch (SoldOutException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "sold_out"));
        } catch (PessimisticLockingFailureException | QueryTimeoutException e) {
            return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(Map.of("status", "lock_timeout"));
        } catch (OptimisticLockRetryExhaustedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "optimistic_lock_exhausted"));
        } catch (UnknownReservationStrategyException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", "unknown_strategy"));
        }
    }
}
