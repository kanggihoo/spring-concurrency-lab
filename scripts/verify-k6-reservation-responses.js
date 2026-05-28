import { readFileSync } from "node:fs";

const scriptPaths = [
  "k6/reservation-test.js",
];

let failures = 0;

for (const scriptPath of scriptPaths) {
  const source = readFileSync(scriptPath, "utf8");
  const checks = [
    {
      name: "declares reservation response callback",
      passed: source.includes(
        "const reservationResponseCallback = http.expectedStatuses(200, 409, 500);",
      ),
    },
    {
      name: "passes reservation response callback to POST params",
      passed: source.includes("responseCallback: reservationResponseCallback"),
    },
    {
      name: "uses combined reservation status check",
      passed: source.includes(
        '"status 200, 409, or expected redis failure": (r) => r.status === 200 || r.status === 409 || r.status === 500',
      ),
    },
    {
      name: "classifies redis response status bodies",
      passed:
        source.includes('new Counter("reservation_status_reserved")') &&
        source.includes('new Counter("reservation_status_sold_out")') &&
        source.includes('new Counter("reservation_status_lock_acquire_failed")') &&
        source.includes('new Counter("reservation_status_redis_db_sync_failed")'),
    },
    {
      name: "does not keep mutually exclusive 200 check",
      passed: !source.includes('"status 200": (r) => r.status === 200'),
    },
    {
      name: "does not keep mutually exclusive 409 check",
      passed: !source.includes('"status 409 (sold out)": (r) => r.status === 409'),
    },
  ];

  for (const check of checks) {
    if (!check.passed) {
      console.error(`${scriptPath}: ${check.name}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
