#!/usr/bin/env bash
set -euo pipefail

K6_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$K6_DIR/.." && pwd)"

PRESET_NAME="${1:-baseline}"
MODE="${2:-prometheus}"
PRESET_FILE="$K6_DIR/presets/${PRESET_NAME}.json"
K6_SCRIPT="reservation-test.js"

json_string_value() {
  local key="$1"
  sed -nE "s/^[[:space:]]*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]*)\".*$/\1/p" "$PRESET_FILE" | head -n 1
}

K6_TAIL_ONLY="${K6_TAIL_ONLY:-0}"
K6_TAIL_LINES="${K6_TAIL_LINES:-120}"
K6_RUN_WINDOW_FILE="${K6_RUN_WINDOW_FILE:-auto}"
K6_WRITE_RUN_WINDOW_ON_FAILURE="${K6_WRITE_RUN_WINDOW_ON_FAILURE:-0}"
K6_WINDOW_START_PADDING_MS="${K6_WINDOW_START_PADDING_MS:-10000}"
K6_WINDOW_END_PADDING_MS="${K6_WINDOW_END_PADDING_MS:-20000}"

usage() {
  echo "Usage: $0 [baseline|spike|ramp-up|sustained] [local|prometheus]" >&2
}

if [[ "$PRESET_NAME" == "-h" || "$PRESET_NAME" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$PRESET_FILE" ]]; then
  echo "Unknown k6 preset: $PRESET_NAME" >&2
  echo "Expected file: $PRESET_FILE" >&2
  usage
  exit 1
fi

PRESET_PHASE="$(json_string_value phase)"
PRESET_SCENARIO="$(json_string_value scenario)"
PRESET_TAG="$(json_string_value preset)"
PRESET_POOL="$(json_string_value pool)"
PRESET_EVIDENCE_DIR="$(json_string_value evidenceDir)"

if [[ -z "$PRESET_PHASE" || -z "$PRESET_SCENARIO" || -z "$PRESET_TAG" || -z "$PRESET_POOL" ]]; then
  echo "Preset must define string fields: phase, scenario, preset, pool" >&2
  exit 1
fi

RUN_ID="${K6_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
EVIDENCE_PHASE_DIR="${K6_EVIDENCE_PHASE_DIR:-${PRESET_EVIDENCE_DIR:-$PRESET_PHASE}}"
EVIDENCE_ROOT="${K6_EVIDENCE_ROOT:-$ROOT_DIR/docs/evidence}"
EVIDENCE_DIR="$EVIDENCE_ROOT/$EVIDENCE_PHASE_DIR"

if ! [[ "$K6_TAIL_LINES" =~ ^[0-9]+$ ]] || [[ "$K6_TAIL_LINES" -eq 0 ]]; then
  echo "Invalid K6_TAIL_LINES: $K6_TAIL_LINES" >&2
  exit 1
fi

if [[ "$K6_TAIL_ONLY" != "0" && "$K6_TAIL_ONLY" != "1" ]]; then
  echo "Invalid K6_TAIL_ONLY: $K6_TAIL_ONLY" >&2
  exit 1
fi

if ! [[ "$K6_WINDOW_START_PADDING_MS" =~ ^[0-9]+$ ]]; then
  echo "Invalid K6_WINDOW_START_PADDING_MS: $K6_WINDOW_START_PADDING_MS" >&2
  exit 1
fi

if ! [[ "$K6_WINDOW_END_PADDING_MS" =~ ^[0-9]+$ ]]; then
  echo "Invalid K6_WINDOW_END_PADDING_MS: $K6_WINDOW_END_PADDING_MS" >&2
  exit 1
fi

if [[ "$K6_WRITE_RUN_WINDOW_ON_FAILURE" != "0" && "$K6_WRITE_RUN_WINDOW_ON_FAILURE" != "1" ]]; then
  echo "Invalid K6_WRITE_RUN_WINDOW_ON_FAILURE: $K6_WRITE_RUN_WINDOW_ON_FAILURE" >&2
  exit 1
fi

RESULTS_DIR="${K6_RESULTS_DIR:-$EVIDENCE_DIR/k6}"
LOGS_DIR="${K6_LOGS_DIR:-$EVIDENCE_DIR/logs}"
GRAFANA_DIR="${K6_GRAFANA_DIR:-$EVIDENCE_DIR/grafana}"
LOG_FILE="${K6_LOG_FILE:-$LOGS_DIR/${PRESET_NAME}-${MODE}-${RUN_ID}.log}"
SUMMARY_FILE="${K6_SUMMARY_FILE:-$RESULTS_DIR/${PRESET_NAME}-${MODE}-${RUN_ID}-summary.json}"
SUMMARY_FILE_CONTAINER="/evidence/$EVIDENCE_PHASE_DIR/k6/$(basename "$SUMMARY_FILE")"

if [[ "$K6_RUN_WINDOW_FILE" == "auto" ]]; then
  K6_RUN_WINDOW_FILE="$GRAFANA_DIR/run-window-${PRESET_NAME}-${MODE}-${RUN_ID}.json"
fi

case "$MODE" in
  local)
    if command -v k6 >/dev/null 2>&1; then
      BASE_URL="${BASE_URL:-http://localhost:8080}"
      RUN_DIR="$K6_DIR"
      K6_CMD=(
        k6 run
        --summary-export "$SUMMARY_FILE"
        -e PRESET="presets/${PRESET_NAME}.json"
        -e BASE_URL="$BASE_URL"
        "$K6_SCRIPT"
      )
    else
      BASE_URL="${BASE_URL:-http://host.docker.internal:8080}"
      RUN_DIR="$ROOT_DIR"
      K6_CMD=(
        docker run --rm -i
        -v "$K6_DIR:/k6"
        -v "$EVIDENCE_ROOT:/evidence"
        -w /k6
        grafana/k6
        run
        --summary-export "$SUMMARY_FILE_CONTAINER"
        -e PRESET="/k6/presets/${PRESET_NAME}.json"
        -e BASE_URL="$BASE_URL"
        "/k6/$K6_SCRIPT"
      )
    fi
    ;;
  prometheus)
    BASE_URL="${BASE_URL:-http://host.docker.internal:8080}"
    RUN_DIR="$ROOT_DIR"
    # Prevent Git Bash from rewriting Docker container paths like /k6/*.js.
    export MSYS_NO_PATHCONV="${MSYS_NO_PATHCONV:-1}"
    K6_CMD=(
      docker compose --profile test run --rm k6
      run
      --out experimental-prometheus-rw
      --summary-export "$SUMMARY_FILE_CONTAINER"
      -e PRESET="/k6/presets/${PRESET_NAME}.json"
      -e BASE_URL="$BASE_URL"
      "/k6/$K6_SCRIPT"
    )
    ;;
  *)
    echo "Unknown k6 mode: $MODE" >&2
    usage
    exit 1
    ;;
esac

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$SUMMARY_FILE")" "$(dirname "$K6_RUN_WINDOW_FILE")"

echo "k6 preset: $PRESET_FILE"
echo "k6 mode: $MODE"
echo "k6 base URL: $BASE_URL"
echo "k6 log: $LOG_FILE"
echo "k6 summary: $SUMMARY_FILE"

set +e
STARTED_AT="$(($(date +%s) * 1000))"
if [[ "$K6_TAIL_ONLY" == "1" ]]; then
  (
    cd "$RUN_DIR"
    "${K6_CMD[@]}"
  ) > "$LOG_FILE" 2>&1
  STATUS=$?
else
  (
    cd "$RUN_DIR"
    "${K6_CMD[@]}"
  ) 2>&1 | tee "$LOG_FILE"
  STATUS=${PIPESTATUS[0]}
fi
ENDED_AT="$(($(date +%s) * 1000))"
set -e

if [[ "$K6_RUN_WINDOW_FILE" != "0" && ( "$STATUS" -eq 0 || "$K6_WRITE_RUN_WINDOW_ON_FAILURE" == "1" ) ]]; then
  GRAFANA_FROM="$((STARTED_AT - K6_WINDOW_START_PADDING_MS))"
  GRAFANA_TO="$((ENDED_AT + K6_WINDOW_END_PADDING_MS))"
  mkdir -p "$(dirname "$K6_RUN_WINDOW_FILE")"
  cat > "$K6_RUN_WINDOW_FILE" <<EOF
{
  "phase": "$PRESET_PHASE",
  "scenario": "$PRESET_SCENARIO",
  "preset": "$PRESET_TAG",
  "pool": "$PRESET_POOL",
  "mode": "$MODE",
  "exitStatus": $STATUS,
  "startedAt": $STARTED_AT,
  "endedAt": $ENDED_AT,
  "grafanaFrom": $GRAFANA_FROM,
  "grafanaTo": $GRAFANA_TO
}
EOF
  echo "k6 run window: $K6_RUN_WINDOW_FILE"
fi

if [[ "$K6_TAIL_ONLY" == "1" ]]; then
  echo "Showing last $K6_TAIL_LINES lines:"
  tail -n "$K6_TAIL_LINES" "$LOG_FILE"
fi

exit "$STATUS"
