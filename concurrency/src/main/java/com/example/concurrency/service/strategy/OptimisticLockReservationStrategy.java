package com.example.concurrency.service.strategy;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import com.example.concurrency.service.OptimisticLockRetryExhaustedException;
import com.example.concurrency.service.ReservationCommand;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.OptimisticLockException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class OptimisticLockReservationStrategy implements ReservationStrategy {

    private static final int MAX_OPTIMISTIC_ATTEMPTS = 5;

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
    private final TransactionTemplate transactionTemplate;
    private final Counter optimisticRetryCounter;

    public OptimisticLockReservationStrategy(ConcertRepository concertRepository,
                                             ReservationRepository reservationRepository,
                                             PlatformTransactionManager transactionManager,
                                             MeterRegistry meterRegistry) {
        this.concertRepository = concertRepository;
        this.reservationRepository = reservationRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.optimisticRetryCounter = Counter.builder("reservation.optimistic.retry")
                .description("Optimistic lock retry attempts")
                .register(meterRegistry);
    }

    @Override
    public String name() {
        return "optimistic";
    }

    @Override
    public void reserve(ReservationCommand command) {
        int attempts = 0;

        while (attempts < MAX_OPTIMISTIC_ATTEMPTS) {
            try {
                transactionTemplate.executeWithoutResult(status -> reserveOnce(command));
                return;
            } catch (ObjectOptimisticLockingFailureException | OptimisticLockException e) {
                attempts++;
                optimisticRetryCounter.increment();
                if (attempts >= MAX_OPTIMISTIC_ATTEMPTS) {
                    throw new OptimisticLockRetryExhaustedException(attempts);
                }
            }
        }
    }

    private void reserveOnce(ReservationCommand command) {
        Concert concert = concertRepository.findById(command.concertId())
                .orElseThrow(() -> new IllegalArgumentException("Concert not found. id=" + command.concertId()));

        concert.reserveOneSeat();
        reservationRepository.save(new Reservation(command.concertId(), command.userId()));
    }
}
