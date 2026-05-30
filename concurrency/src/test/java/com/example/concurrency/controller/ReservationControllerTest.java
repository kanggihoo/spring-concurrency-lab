package com.example.concurrency.controller;

import com.example.concurrency.domain.Concert;
import com.example.concurrency.repository.ConcertRepository;
import com.example.concurrency.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ReservationControllerTest {

    private static final long CONCERT_ID = 1L;
    private static final int INITIAL_SEAT_COUNT = 100;

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
        Concert concert = concertRepository.findById(CONCERT_ID)
                .orElseGet(() -> concertRepository.save(new Concert("Concert A", INITIAL_SEAT_COUNT)));
        concert.resetRemainingSeats(INITIAL_SEAT_COUNT);
        concertRepository.saveAndFlush(concert);
    }

    @Test
    @DisplayName("기존 기본 예약 endpoint는 no-lock 전략으로 성공 응답을 반환한다")
    void reserveDefault_usesNoLockStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("기존 atomic endpoint 경로는 계속 성공 응답을 반환한다")
    void reserveAtomic_compatibilityPathStillWorks() throws Exception {
        mockMvc.perform(post("/api/reservations/atomic")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("새 generic endpoint는 no-lock 전략 이름으로 예약을 실행한다")
    void reserveGeneric_noLockStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations/no-lock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":3}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("reserved")));
    }

    @Test
    @DisplayName("알 수 없는 전략은 unknown_strategy 응답을 반환한다")
    void reserveGeneric_unknownStrategy() throws Exception {
        mockMvc.perform(post("/api/reservations/not-real")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"concertId":1,"userId":4}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is("unknown_strategy")));
    }
}
