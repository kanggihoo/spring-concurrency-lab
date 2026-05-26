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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class DbStrategiesConcurrencyTest {

    private static final long CONCERT_ID = 1L;
    private static final int INITIAL_SEAT_COUNT = 100;

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
        Concert concert = concertRepository.findById(CONCERT_ID)
                .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
        concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
        concertRepository.saveAndFlush(concert);
    }

    @Test
    @DisplayName("Pessimistic Lock: concurrent reservations preserve counted-seat invariant")
    void pessimisticLock_concurrentReservations_preserveInvariant() throws InterruptedException {
        StrategyResult result = runConcurrentReservations(userId ->
                reservationService.reserveWithPessimisticLock(CONCERT_ID, userId));

        Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
        long reservationCount = reservationRepository.countByConcertId(CONCERT_ID);

        assertThat(result.successCount()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(result.failureCount()).isZero();
        assertThat(reservationCount).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount + concert.getRemainingSeats()).isEqualTo(INITIAL_SEAT_COUNT);
        assertThat(reservationCount).isLessThanOrEqualTo(INITIAL_SEAT_COUNT);
    }

    @Test
    @DisplayName("Pessimistic Lock: sold-out request does not create Reservation")
    void pessimisticLock_soldOut_doesNotCreateReservation() {
        Concert concert = concertRepository.findById(CONCERT_ID).orElseThrow();
        concert.resetRemainingSeats(0);
        concertRepository.saveAndFlush(concert);

        assertThatThrownBy(() -> reservationService.reserveWithPessimisticLock(CONCERT_ID, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Sold out");

        assertThat(reservationRepository.countByConcertId(CONCERT_ID)).isZero();
    }

    private StrategyResult runConcurrentReservations(ReservationCommand command) throws InterruptedException {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger failureCount = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            long userId = i + 1L;
            executor.submit(() -> {
                try {
                    command.reserve(userId);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                    failureCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();
        return new StrategyResult(successCount.get(), failureCount.get());
    }

    @FunctionalInterface
    private interface ReservationCommand {
        void reserve(long userId);
    }

    private record StrategyResult(int successCount, int failureCount) {
    }
}
