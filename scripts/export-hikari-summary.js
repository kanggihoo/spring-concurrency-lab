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

function requireNumber(name, value) {
  if (value === null) {
    throw new Error(`${name} is null. Prometheus has no Hikari sample in the k6 execution window.`);
  }
  return value;
}

const args = parseArgs(process.argv);
const runWindow = JSON.parse(readFileSync(args.runWindow, "utf8"));
const evidenceRange = secondsRange(runWindow.startedAt, runWindow.endedAt);
const grafanaRange = secondsRange(runWindow.grafanaFrom, runWindow.grafanaTo);
const queryTime = Math.floor(runWindow.endedAt / 1000);

const queries = {
  hikariMaxMin: `min_over_time(hikaricp_connections_max[${evidenceRange}])`,
  hikariMaxMax: `max_over_time(hikaricp_connections_max[${evidenceRange}])`,
  hikariActiveMax: `max(max_over_time(hikaricp_connections_active[${evidenceRange}]))`,
  hikariPendingMax: `max(max_over_time(hikaricp_connections_pending[${evidenceRange}]))`,
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
    evidenceRange,
    grafanaRange,
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

const expectedPool = Number(runWindow.pool);
const hikariMaxMin = requireNumber("hikariMaxMin", output.queries.hikariMaxMin.value);
const hikariMaxMax = requireNumber("hikariMaxMax", output.queries.hikariMaxMax.value);
const hikariActiveMax = requireNumber("hikariActiveMax", output.queries.hikariActiveMax.value);

if (hikariMaxMin !== expectedPool || hikariMaxMax !== expectedPool) {
  throw new Error(
    `Hikari max does not match run-window pool: pool=${expectedPool}, min=${hikariMaxMin}, max=${hikariMaxMax}`,
  );
}

if (hikariActiveMax > hikariMaxMax) {
  throw new Error(`Hikari active max exceeds Hikari max: active=${hikariActiveMax}, max=${hikariMaxMax}`);
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`wrote ${args.out}`);
