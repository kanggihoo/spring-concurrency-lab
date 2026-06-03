package com.example.concurrency.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

    @Column(name = "remaining_seats", nullable = false)
    private int remainingSeats;

    @Version
    @Column(nullable = false)
    private Long version;

    public Concert(String title, int remainingSeats) {
        this.title = title;
        this.remainingSeats = remainingSeats;
        this.version = 0L;
    }

    public void resetRemainingSeats(int remainingSeats) {
        this.remainingSeats = remainingSeats;
    }

    public void decreaseRemainingSeats() {
        this.remainingSeats--;
    }

    public void reserveOneSeat() {
        if (this.remainingSeats <= 0) {
            throw new SoldOutException();
        }
        this.remainingSeats--;
    }
}
