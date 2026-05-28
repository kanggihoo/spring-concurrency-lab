package com.example.concurrency;

import com.example.concurrency.redis.RedisSeatStore;
import com.example.concurrency.service.DbReservationWriter;
import com.example.concurrency.service.RedisReservationException;
import com.example.concurrency.service.ReservationService;
import com.redis.testcontainers.RedisContainer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;

@SpringBootTest
@Testcontainers
class RedisLuaCompensationTest {

    private static final long CONCERT_ID = 1L;

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("reservation")
            .withUsername("user")
            .withPassword("password");

    @Container
    static RedisContainer redis = new RedisContainer(DockerImageName.parse("redis:alpine"));

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getRedisHost);
        registry.add("spring.data.redis.port", redis::getRedisPort);
    }

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private RedisSeatStore redisSeatStore;

    @MockitoBean
    private DbReservationWriter dbReservationWriter;

    @BeforeEach
    void setUp() {
        redisSeatStore.initializeRemainingSeats(CONCERT_ID, 1);
    }

    @Test
    @DisplayName("Redis Lua: DB failure after decrement compensates Redis Remaining Seats")
    void redisLua_dbFailureAfterDecrement_compensatesRedisRemainingSeats() {
        doThrow(new RuntimeException("forced DB failure"))
                .when(dbReservationWriter)
                .reserveWithAtomicUpdate(eq(CONCERT_ID), eq(1L));

        assertThatThrownBy(() -> reservationService.reserveWithRedisLua(CONCERT_ID, 1L))
                .isInstanceOf(RedisReservationException.class);

        assertThat(redisSeatStore.getRemainingSeats(CONCERT_ID)).isEqualTo(1);
    }
}
