package com.example.concurrency.controller;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public TestController(ConcertRepository concertRepository,
                          ReservationRepository reservationRepository) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> simpleTest() throws InterruptedException {
        Thread.sleep(10);
        return ResponseEntity.ok(Map.of("message", "Load test API is working!"));
    }

    /**
     * Reset endpoint for k6 load testing.
     */
    @PostMapping("/reset")
    @Transactional
    public ResponseEntity<Map<String, String>> reset() {
        // 1. delete all reservations
        reservationRepository.deleteAll();

        // 2. reset remaining seats (create if not exists)
        Concert concert = concertRepository.findById(1L).orElse(null);
        if (concert == null) {
            concert = new Concert("Concert A", 100);
        } else {
            concert.resetRemainingSeats(100);
        }
        concertRepository.save(concert);

        return ResponseEntity.ok(Map.of("status", "reset", "remainingSeats", "100"));
    }
}
