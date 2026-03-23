package com.example.concurrency.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 콘서트 엔티티 — 예약 가능한 좌석(stock)을 관리한다.
 * Phase 2에서는 @Version 없이 동시성 제어 없음 (의도적 Race Condition).
 */
@Entity
@Table(name = "concert")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Concert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    // 남은 좌석 수 — 동시 접근 시 정합성이 깨질 수 있음
    @Column(nullable = false)
    private int stock;

    public Concert(String title, int stock) {
        this.title = title;
        this.stock = stock;
    }

    // 테스트 초기화용
    public void setStock(int stock) {
        this.stock = stock;
    }

    // 재고 1 차감 — 락 없이 호출 시 lost update 발생 가능
    public void decreaseStock() {
        this.stock--;
    }
}
