import { Counter, Gauge } from "k6/metrics";

export function createReservationMetrics() {
  return {
    reservedResponses: new Counter("reservation_reserved"),
    soldOutResponses: new Counter("reservation_sold_out"),
    lockTimeoutResponses: new Counter("reservation_lock_timeout"),
    unexpectedResponses: new Counter("reservation_unexpected_status"),
    reservationCount: new Gauge("concert_reservation_count"),
    remainingSeats: new Gauge("concert_remaining_seats"),
    seatCountInconsistency: new Gauge("concert_seat_count_inconsistency"),
    overbooked: new Gauge("concert_overbooked"),
  };
}

export function initializeMetrics(metrics) {
  metrics.reservedResponses.add(0);
  metrics.soldOutResponses.add(0);
  metrics.lockTimeoutResponses.add(0);
  metrics.unexpectedResponses.add(0);
}
