package com.example.concurrency.controller;

/**
 * Reservation API request body.
 */
public record ReservationRequest(Long concertId, Long userId) {
}
