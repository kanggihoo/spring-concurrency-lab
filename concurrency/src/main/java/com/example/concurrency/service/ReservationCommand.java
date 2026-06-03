package com.example.concurrency.service;

public record ReservationCommand(Long concertId, Long userId) {
}
