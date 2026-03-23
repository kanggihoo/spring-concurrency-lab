package com.example.concurrency;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;


import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class ReservationConcurrencyTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElse(null);
        if (concert == null) {
            concert = new Concert("Concert A", 100); // Concert(title , stock)
            concertRepository.save(concert);
        } else {
            concert.setStock(100);
            concertRepository.save(concert);
        }
    }

    @Test
    @DisplayName("락 없이 100명 동시 예약 시 overselling이 발생한다")
    void noLock_concurrency_causes_overselling() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    reservationService.reserve(1L, userId);
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();

        Concert concert = concertRepository.findById(1L).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(1L);

        System.out.println("Remaining stock: " + concert.getStock());
        System.out.println("Reservation count: " + reservationCount);
        System.out.println("Integrity error: " + (reservationCount - (100 - concert.getStock())));

        // overselling check: reservationCount + stock != 100 means data integrity is broken
        assertThat(reservationCount + concert.getStock()).isNotEqualTo(100);
    }
}
