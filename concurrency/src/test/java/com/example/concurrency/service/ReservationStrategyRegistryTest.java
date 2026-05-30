package com.example.concurrency.service;

import com.example.concurrency.service.strategy.ReservationStrategy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReservationStrategyRegistryTest {

    @Test
    @DisplayName("전략 이름으로 ReservationStrategy를 조회한다")
    void get_returnsStrategyByName() {
        ReservationStrategy strategy = new TestStrategy("atomic");
        ReservationStrategyRegistry registry = new ReservationStrategyRegistry(List.of(strategy));

        assertThat(registry.get("atomic")).isSameAs(strategy);
    }

    @Test
    @DisplayName("없는 전략 이름은 UnknownReservationStrategyException을 던진다")
    void get_unknownName_throwsException() {
        ReservationStrategyRegistry registry = new ReservationStrategyRegistry(List.of(new TestStrategy("atomic")));

        assertThatThrownBy(() -> registry.get("missing"))
                .isInstanceOf(UnknownReservationStrategyException.class)
                .hasMessageContaining("Unknown reservation strategy: missing");
    }

    @Test
    @DisplayName("중복 전략 이름은 애플리케이션 시작 전에 실패한다")
    void constructor_duplicateStrategyName_throwsException() {
        assertThatThrownBy(() -> new ReservationStrategyRegistry(List.of(
                new TestStrategy("atomic"),
                new TestStrategy("atomic")
        )))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate reservation strategy: atomic");
    }

    @Test
    @DisplayName("ReservationUseCase는 registry에서 찾은 전략을 실행한다")
    void reserve_executesSelectedStrategy() {
        AtomicBoolean executed = new AtomicBoolean(false);
        ReservationStrategy strategy = new TestStrategy("atomic") {
            @Override
            public void reserve(ReservationCommand command) {
                executed.set(true);
            }
        };
        ReservationUseCase useCase = new ReservationUseCase(new ReservationStrategyRegistry(List.of(strategy)));

        useCase.reserve("atomic", new ReservationCommand(1L, 10L));

        assertThat(executed).isTrue();
    }

    private static class TestStrategy implements ReservationStrategy {

        private final String name;

        private TestStrategy(String name) {
            this.name = name;
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public void reserve(ReservationCommand command) {
        }
    }
}
