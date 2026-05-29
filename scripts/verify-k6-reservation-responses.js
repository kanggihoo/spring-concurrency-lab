import { readFileSync } from "node:fs";

const scriptPaths = [
  "k6/reservation-test.js",
];

let failures = 0;

for (const scriptPath of scriptPaths) {
  const source = readFileSync(scriptPath, "utf8");
  const checks = [
    {
      name: "declares expected statuses from preset",
      passed: source.includes("const expectedStatuses = preset.expectedStatuses || [200, 409];"),
    },
    {
      name: "declares preset-driven response callback",
      passed: source.includes("const reservationResponseCallback = http.expectedStatuses(...expectedStatuses);"),
    },
    {
      name: "uses preset-driven expected status check",
      passed: source.includes('"status is expected": (r) => expectedStatuses.includes(r.status)'),
    },
    {
      name: "declares p99 summary trend stats",
      passed: source.includes('summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]'),
    },
    {
      name: "declares response classification counters",
      passed:
        source.includes('new Counter("reservation_reserved")') &&
        source.includes('new Counter("reservation_sold_out")') &&
        source.includes('new Counter("reservation_lock_timeout")') &&
        source.includes('new Counter("reservation_unexpected_status")'),
    },
    {
      name: "does not keep hard-coded 200/409 callback",
      passed: !source.includes("const reservationResponseCallback = http.expectedStatuses(200, 409);"),
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
