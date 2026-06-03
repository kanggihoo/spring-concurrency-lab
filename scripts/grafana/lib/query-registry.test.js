import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryRegistry, getQuery, withNoDataFallback } from './query-registry.js';

test('buildQueryRegistry indexes query aliases from multiple YAML documents', () => {
  const registry = buildQueryRegistry([
    {
      'k6.http.p95': {
        expr: 'max(k6_http_req_duration_p95{phase="$phase"})',
        zeroWhenNoData: true,
      },
    },
    {
      'hikari.active': {
        expr: 'hikaricp_connections_active',
      },
    },
  ]);

  assert.equal(getQuery(registry, 'k6.http.p95').expr, 'max(k6_http_req_duration_p95{phase="$phase"})');
  assert.equal(getQuery(registry, 'k6.http.p95').zeroWhenNoData, true);
  assert.equal(getQuery(registry, 'hikari.active').zeroWhenNoData, true);
});

test('buildQueryRegistry rejects duplicate query aliases', () => {
  assert.throws(
    () => buildQueryRegistry([
      { 'k6.http.rps': { expr: 'sum(rate(k6_http_reqs_total[$__rate_interval]))' } },
      { 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } },
    ]),
    /Duplicate Grafana query alias: k6\.http\.rps/,
  );
});

test('buildQueryRegistry rejects invalid query definitions', () => {
  assert.throws(
    () => buildQueryRegistry([{ 'k6.http.rps': { zeroWhenNoData: true } }]),
    /Grafana query k6\.http\.rps must define a non-empty expr/,
  );
});

test('getQuery rejects unknown aliases with a useful message', () => {
  const registry = buildQueryRegistry([{ 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } }]);

  assert.throws(
    () => getQuery(registry, 'missing.query'),
    /Unknown Grafana query alias: missing\.query/,
  );
});

test('withNoDataFallback wraps expressions once', () => {
  assert.equal(
    withNoDataFallback('sum(rate(k6_http_reqs_total[$__rate_interval]))'),
    '(sum(rate(k6_http_reqs_total[$__rate_interval]))) or on() vector(0)',
  );
  assert.equal(
    withNoDataFallback('(sum(k6_http_reqs_total)) or on() vector(0)'),
    '(sum(k6_http_reqs_total)) or on() vector(0)',
  );
});
