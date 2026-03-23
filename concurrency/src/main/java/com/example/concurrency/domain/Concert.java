package com.example.concurrency.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 콘서트 엔티티 — 예약 가능한 좌석(stock)을 관리한다.
 * Phase 3: @Version 추가로 낙관적 락 지원.
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

    // 남은 좌석 수
    @Column(nullable = false)
    private int stock;

    // 낙관적 락용 버전 컬럼 — UPDATE 시 version 불일치면 OptimisticLockException 발생
    @Version
    private Long version;

    public Concert(String title, int stock) {
        this.title = title;
        this.stock = stock;
    }

    // 테스트 초기화용
    public void setStock(int stock) {
        this.stock = stock;
    }

    // 재고 1 차감 — 재고 부족 시 예외 발생
    public void decreaseStock() {
        if (this.stock <= 0) {
            throw new IllegalStateException("Sold out.");
        }
        this.stock--;
    }
}
