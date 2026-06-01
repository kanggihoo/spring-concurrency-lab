const DEFAULT_PRESET_PATH = "presets/baseline.json";
const DEFAULT_BASE_URL = "http://host.docker.internal:8080";
const DEFAULT_RESERVATION_PATH = "/api/reservations";
const DEFAULT_EXPECTED_STATUSES = [200, 409];

function requiredString(preset, presetPath, name) {
  const value = preset[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Preset ${presetPath} must define non-empty string field: ${name}`);
  }
  return value;
}

function normalizeExpectedStatuses(preset, presetPath) {
  const expectedStatuses = preset.expectedStatuses || DEFAULT_EXPECTED_STATUSES;
  const validStatuses =
    Array.isArray(expectedStatuses) &&
    expectedStatuses.length > 0 &&
    expectedStatuses.every((status) => Number.isInteger(status) && status >= 100 && status <= 599);

  if (!validStatuses) {
    throw new Error(`Preset ${presetPath} must define expectedStatuses as HTTP status integers`);
  }

  return expectedStatuses;
}

function normalizeSleepSeconds(preset, presetPath) {
  const sleepSeconds = preset.sleepSeconds || 0;
  if (!Number.isFinite(sleepSeconds) || sleepSeconds < 0) {
    throw new Error(`Preset ${presetPath} must define sleepSeconds as a non-negative number`);
  }
  return sleepSeconds;
}

export function loadConfig(env = __ENV) {
  const presetPath = env.PRESET || DEFAULT_PRESET_PATH;
  const preset = JSON.parse(open(presetPath));
  const phase = requiredString(preset, presetPath, "phase");
  const scenario = requiredString(preset, presetPath, "scenario");
  const presetName = requiredString(preset, presetPath, "preset");
  const pool = env.POOL || requiredString(preset, presetPath, "pool");
  const baseUrl = env.BASE_URL || preset.baseUrl || DEFAULT_BASE_URL;

  return {
    presetPath,
    preset,
    baseUrl,
    reservationPath: preset.path || DEFAULT_RESERVATION_PATH,
    expectedStatuses: normalizeExpectedStatuses(preset, presetPath),
    phase,
    scenario,
    presetName,
    pool,
    tags: {
      phase,
      scenario,
      preset: presetName,
      pool,
    },
    resetBeforeRun: preset.resetBeforeRun !== false,
    captureConsistency: preset.captureConsistency !== false,
    sleepSeconds: normalizeSleepSeconds(preset, presetPath),
    concertId: preset.concertId || 1,
  };
}
