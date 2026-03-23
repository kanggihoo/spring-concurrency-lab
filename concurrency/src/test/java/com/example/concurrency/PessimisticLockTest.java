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
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class PessimisticLockTest {

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

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElse(null);
        if (concert == null) {
            concert = new Concert("Concert A", 100);
            concertRepository.save(concert);
        } else {
            concert.setStock(100);
            concertRepository.save(concert);
        }
    }

    // ========== API Unit Tests ==========

    @Test
    @DisplayName("Pessimistic lock - single reservation returns 200 OK")
    void pessimisticLock_single_reservation_returns_200() {
        // given
        String body = "{\"concertId\": 1, \"userId\": 1}";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>(body, headers);

        // when
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/reservations/pessimistic", request, String.class);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(200);

        Concert concert = concertRepository.findById(1L).orElseThrow();
        assertThat(concert.getStock()).isEqualTo(99);
    }

    @Test
    @DisplayName("Pessimistic lock - returns 409 when sold out")
    void pessimisticLock_returns_409_when_sold_out() {
        // given - set stock to 0
        Concert concert = concertRepository.findById(1L).orElseThrow();
        concert.setStock(0);
        concertRepository.save(concert);

        String body = "{\"concertId\": 1, \"userId\": 1}";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>(body, headers);

        // when
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/reservations/pessimistic", request, String.class);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(409);
    }

    // ========== Service Concurrency Test ==========

    @Test
    @DisplayName("Pessimistic lock - 100 concurrent threads, data integrity guaranteed")
    void pessimisticLock_service_100_concurrent_threads_integrity() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    reservationService.reserveWithPessimisticLock(1L, userId);
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();
        executor.shutdown();

        Concert concert = concertRepository.findById(1L).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(1L);

        System.out.println("[Pessimistic Lock - Service] Success: " + successCount.get()
                + ", Fail: " + failCount.get()
                + ", Stock: " + concert.getStock()
                + ", Reservations: " + reservationCount);

        // integrity check: success count + remaining stock = 100
        assertThat(concert.getStock()).isGreaterThanOrEqualTo(0);
        assertThat(successCount.get() + concert.getStock()).isEqualTo(100);
        assertThat(reservationCount).isEqualTo(successCount.get());
    }

    // ========== API Concurrency Test ==========

    @Test
    @DisplayName("Pessimistic lock - 100 concurrent API requests, data integrity guaranteed")
    void pessimisticLock_api_100_concurrent_requests_integrity() throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1;
            executor.submit(() -> {
                try {
                    String body = "{\"concertId\": 1, \"userId\": " + userId + "}";
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    HttpEntity<String> request = new HttpEntity<>(body, headers);

                    ResponseEntity<String> response = restTemplate.postForEntity(
                            "/api/reservations/pessimistic", request, String.class);

                    if (response.getStatusCode().value() == 200) {
                        successCount.incrementAndGet();
                    } else {
                        failCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await();
        executor.shutdown();

        Concert concert = concertRepository.findById(1L).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(1L);

        System.out.println("[Pessimistic Lock - API] Success: " + successCount.get()
                + ", Fail: " + failCount.get()
                + ", Stock: " + concert.getStock()
                + ", Reservations: " + reservationCount);

        // integrity check
        assertThat(concert.getStock()).isGreaterThanOrEqualTo(0);
        assertThat(successCount.get() + concert.getStock()).isEqualTo(100);
        assertThat(reservationCount).isEqualTo(successCount.get());
    }
}
