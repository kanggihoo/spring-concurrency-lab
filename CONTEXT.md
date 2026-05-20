# Concert Reservation Concurrency Lab

콘서트 예약이라는 한정 자원 시나리오에서 동시성 제어 전략의 정합성, 처리량, 지연 시간, 운영 복잡도를 비교하는 실험 컨텍스트다.

## Language

**Concert**:
예약 가능한 단일 공연 회차.
_Avoid_: event, show, performance

**User**:
Concert를 예약했거나 예약하려는 사람.
_Avoid_: customer, account, payer

**Reservation**:
사용자가 Concert의 좌석 하나를 성공적으로 예약했다는 확정 기록.
_Avoid_: order, purchase, attempt

**Remaining Seats**:
Concert에서 아직 예약되지 않은 좌석 수.
_Avoid_: stock, inventory, available seats

**Initial Seat Count**:
Concert가 예약을 받기 시작할 때 가진 전체 좌석 수.
_Avoid_: total stock, capacity

**Overbooking**:
성공한 Reservation 수가 Concert의 최초 좌석 수를 초과한 상태.
_Avoid_: overselling

**Seat Count Inconsistency**:
성공한 Reservation 수와 Remaining Seats가 함께 설명하는 좌석 수가 Concert의 최초 좌석 수와 맞지 않는 상태.
_Avoid_: integrity error

## Relationships

- A **Concert** has one **Initial Seat Count** and one **Remaining Seats** count.
- A **Reservation** belongs to exactly one **Concert** and represents a successful reservation only.
- A **Reservation** is made by exactly one **User**.
- A **User** can make zero or more **Reservations**.
- For a given **Concert**, a **User** should have at most one successful **Reservation**.
- For this lab, `reservation_count + remaining_seats` should equal the initial seat count after all successful reservations.
- **Seat Count Inconsistency** can exist before **Overbooking** is directly observed.

## Model boundaries

- This lab uses a counted-seat model: a **Concert** stores a seat count, not individual seat numbers.
- Seat selection, seat assignment, sections, rows, and holds are outside this lab.

## Example dialogue

> **Dev:** "동시에 100명이 같은 **Concert**를 예약하면 **Remaining Seats**는 어떻게 검증하나요?"
> **Domain expert:** "성공한 **Reservation** 수와 **Remaining Seats**를 더했을 때 최초 좌석 수와 같아야 합니다. 다르면 **Seat Count Inconsistency**이고, 그 상태가 방치되면 **Overbooking**으로 이어질 수 있습니다."

> **Dev:** "같은 **User**가 같은 **Concert**를 두 번 예약할 수 있나요?"
> **Domain expert:** "아니요. 한 **User**는 같은 **Concert**에 대해 성공한 **Reservation**을 최대 하나만 가져야 합니다."

## Flagged ambiguities

- `stock`, `inventory`, `available seats` were considered for the counted seat field; resolved: use **Remaining Seats** in domain language and `remainingSeats` / `remaining_seats` in code and schema.
- `overselling` was used in earlier roadmap and tests; resolved: use **Overbooking** for the concert reservation domain.
- `Reservation` could mean a successful booking or any request attempt; resolved: **Reservation** means only a successful confirmed record, and failed or retried requests should use a separate term if needed.
- `Overbooking` and `Seat Count Inconsistency` were initially treated as the same failure; resolved: **Seat Count Inconsistency** is the core Phase 2 no-lock failure, and **Overbooking** is a possible downstream business failure.
- `User` appears only as `userId` in code and schema; resolved: **User** is a domain actor, but authentication, profile, account, and payment identity are outside this lab.
- Individual seat numbers were considered; resolved: this lab uses a counted-seat model because the goal is concurrency strategy comparison for limited quantity deduction.
