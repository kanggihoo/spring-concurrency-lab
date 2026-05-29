import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function parseArgs(argv) {
  const args = {
    prometheusUrl: "http://localhost:9090",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--run-window") {
      args.runWindow = value;
      i += 1;
    } else if (arg === "--out") {
      args.out = value;
      i += 1;
    } else if (arg === "--prometheus-url") {
      args.prometheusUrl = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runWindow) throw new Error("--run-window is required");
  if (!args.out) throw new Error("--out is required");

  return args;
}

function secondsRange(fromMs, toMs) {
  return `${Math.max(1, Math.ceil((toMs - fromMs) / 1000))}s`;
}

async function queryPrometheus(baseUrl, query, timeSeconds) {
  const url = new URL("/api/v1/query", baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("time", String(timeSeconds));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (body.status !== "success") {
    throw new Error(`Prometheus returned non-success status: ${JSON.stringify(body)}`);
  }

  return body.data.result;
}

function firstValue(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const value = result[0]?.value?.[1];
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const args = parseArgs(process.argv);
const runWindow = JSON.parse(readFileSync(args.runWindow, "utf8"));
const range = secondsRange(runWindow.grafanaFrom, runWindow.grafanaTo);
const queryTime = Math.floor(runWindow.grafanaTo / 1000);

const queries = {
  hikariMax: "max(hikaricp_connections_max)",
  hikariActiveMax: `max(max_over_time(hikaricp_connections_active[${range}]))`,
  hikariPendingMax: `max(max_over_time(hikaricp_connections_pending[${range}]))`,
};

const output = {
  runWindow: {
    path: args.runWindow,
    phase: runWindow.phase,
    scenario: runWindow.scenario,
    preset: runWindow.preset,
    pool: runWindow.pool,
    mode: runWindow.mode,
    startedAt: runWindow.startedAt,
    endedAt: runWindow.endedAt,
    grafanaFrom: runWindow.grafanaFrom,
    grafanaTo: runWindow.grafanaTo,
    range,
    queryTime,
  },
  prometheusUrl: args.prometheusUrl,
  queries: {},
};

for (const [name, query] of Object.entries(queries)) {
  const result = await queryPrometheus(args.prometheusUrl, query, queryTime);
  output.queries[name] = {
    query,
    value: firstValue(result),
    rawResult: result,
  };
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`wrote ${args.out}`);
