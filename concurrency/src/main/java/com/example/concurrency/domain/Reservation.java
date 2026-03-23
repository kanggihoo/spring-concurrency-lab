package com.example.concurrency.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 예약 엔티티 — 어떤 유저가 어떤 콘서트를 예약했는지 기록한다.
 * concertId는 단순 FK 값으로 관리 (연관관계 매핑 생략).
 */
@Entity
@Table(name = "reservation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 예약 대상 콘서트 ID => 따로 Concert Entity와 관계 X 
    @Column(name = "concert_id", nullable = false)
    private Long concertId;

    // 예약한 사용자 ID
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Reservation(Long concertId, Long userId) {
        this.concertId = concertId;
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
    }
}
