package com.example.concurrency.controller;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.domain.Reservation;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class TestControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @BeforeEach
    void setUp() {
        reservationRepository.deleteAll();
        Concert concert = concertRepository.findById(1L).orElseGet(() -> concertRepository.save(new Concert("Concert A", 100)));
        concert.resetRemainingSeats(12);
        concertRepository.save(concert);
        reservationRepository.save(new Reservation(1L, 1L));
        reservationRepository.save(new Reservation(1L, 2L));
    }

    @Test
    @DisplayName("콘서트 1번의 최종 정합성 스냅샷을 조회한다")
    void consistency_returns_phase2_snapshot_for_concert_one() throws Exception {
        mockMvc.perform(get("/api/test/consistency"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concertId", is(1)))
                .andExpect(jsonPath("$.initialSeatCount", is(100)))
                .andExpect(jsonPath("$.reservationCount", is(2)))
                .andExpect(jsonPath("$.remainingSeats", is(12)))
                .andExpect(jsonPath("$.seatCountInconsistency", is(-86)))
                .andExpect(jsonPath("$.overbooked", is(false)));
    }
}
