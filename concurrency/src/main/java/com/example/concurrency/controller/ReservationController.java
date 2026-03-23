package com.example.concurrency.controller;

import com.example.concurrency.service.ReservationService;
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
}
