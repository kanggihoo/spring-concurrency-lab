import http from "k6/http";

const RESERVED = "reserved";
const SOLD_OUT = "soldOut";
const LOCK_TIMEOUT = "lockTimeout";
const UNEXPECTED = "unexpected";

export function createExpectedStatusCallback(expectedStatuses) {
  return http.expectedStatuses(...expectedStatuses);
}

export function classifyReservationResponse(response) {
  if (response.status === 200) {
    return RESERVED;
  }

  if (response.status === 409) {
    return SOLD_OUT;
  }

  if (response.status === 408) {
    return LOCK_TIMEOUT;
  }

  return UNEXPECTED;
}

export function recordReservationClassification(metrics, classification) {
  if (classification === RESERVED) {
    metrics.reservedResponses.add(1);
    return;
  }

  if (classification === SOLD_OUT) {
    metrics.soldOutResponses.add(1);
    return;
  }

  if (classification === LOCK_TIMEOUT) {
    metrics.lockTimeoutResponses.add(1);
    return;
  }

  metrics.unexpectedResponses.add(1);
}
