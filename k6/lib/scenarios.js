function requiredExecutor(config) {
  const executor = config.preset.executor;
  if (typeof executor !== "string" || executor.length === 0) {
    throw new Error(`Preset ${config.presetPath} must define non-empty string field: executor`);
  }
  return executor;
}

function buildScenario(config) {
  const executor = requiredExecutor(config);

  if (executor === "constant-vus") {
    return {
      executor,
      vus: config.preset.vus,
      duration: config.preset.duration,
    };
  }

  if (executor === "ramping-vus") {
    return {
      executor,
      startVUs: config.preset.startVUs || 0,
      stages: config.preset.stages,
    };
  }

  throw new Error(`Unsupported executor in ${config.presetPath}: ${executor}`);
}

export function buildOptions(config) {
  return {
    tags: config.tags,
    scenarios: {
      [config.scenario]: buildScenario(config),
    },
    thresholds: config.preset.thresholds || {},
    summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  };
}
