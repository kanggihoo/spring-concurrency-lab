# Use a counted-seat model

This lab models a Concert with seat counts instead of individual Seat entities. We chose this because the goal is to compare concurrency strategies for limited quantity deduction, not to implement seat selection, seat assignment, sections, rows, or temporary holds.

**Considered Options**

- Counted-seat model with `remainingSeats`
- Individual seat model with one row per seat

**Consequences**

- The core invariant is `reservation_count + remaining_seats == initial_seat_count`.
- This lab can compare DB locks, conditional updates, Redis strategies, and idempotency without adding seat-map complexity.
- Findings should not be treated as a complete design for numbered-seat ticketing.
