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
        "const reservationResponseCallback = http.expectedStatuses(200, 409);",
      ),
    },
    {
      name: "passes reservation response callback to POST params",
      passed: source.includes("responseCallback: reservationResponseCallback"),
    },
    {
      name: "uses combined reservation status check",
      passed: source.includes('"status 200 or 409": (r) => r.status === 200 || r.status === 409'),
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
