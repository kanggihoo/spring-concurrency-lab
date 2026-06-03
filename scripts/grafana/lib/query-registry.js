export function buildQueryRegistry(documents) {
  const registry = new Map();

  for (const document of documents) {
    for (const [alias, definition] of Object.entries(document)) {
      if (registry.has(alias)) {
        throw new Error(`Duplicate Grafana query alias: ${alias}`);
      }
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new Error(`Grafana query ${alias} must be an object`);
      }
      if (typeof definition.expr !== 'string' || definition.expr.trim() === '') {
        throw new Error(`Grafana query ${alias} must define a non-empty expr`);
      }
      registry.set(alias, {
        expr: definition.expr,
        zeroWhenNoData: definition.zeroWhenNoData !== false,
      });
    }
  }

  return registry;
}

export function getQuery(registry, alias) {
  const query = registry.get(alias);
  if (!query) {
    throw new Error(`Unknown Grafana query alias: ${alias}`);
  }
  return query;
}

export function withNoDataFallback(expr) {
  return expr.includes('or on() vector(0)') ? expr : `(${expr}) or on() vector(0)`;
}
