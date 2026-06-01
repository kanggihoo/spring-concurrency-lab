import test from 'node:test';
import assert from 'node:assert/strict';
import { assignGridPositions, defaultPanelSize } from './layout.js';

test('defaultPanelSize returns stable defaults by panel type', () => {
  assert.deepEqual(defaultPanelSize({ type: 'stat' }), { w: 6, h: 4 });
  assert.deepEqual(defaultPanelSize({ type: 'timeseries' }), { w: 12, h: 8 });
});

test('assignGridPositions fills stat panels left to right', () => {
  const result = assignGridPositions([
    { type: 'stat', title: 'A' },
    { type: 'stat', title: 'B' },
    { type: 'stat', title: 'C' },
    { type: 'stat', title: 'D' },
    { type: 'stat', title: 'E' },
  ], 1);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 1, w: 6, h: 4 },
    { x: 6, y: 1, w: 6, h: 4 },
    { x: 12, y: 1, w: 6, h: 4 },
    { x: 18, y: 1, w: 6, h: 4 },
    { x: 0, y: 5, w: 6, h: 4 },
  ]);
  assert.equal(result.nextY, 9);
});

test('assignGridPositions uses shortest-column packing for mixed heights', () => {
  const result = assignGridPositions([
    { type: 'stat', title: 'Heap Used' },
    { type: 'stat', title: 'Thread Count' },
    { type: 'timeseries', title: 'Process CPU Usage' },
    { type: 'timeseries', title: 'GC Pause Time' },
  ], 30);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 30, w: 6, h: 4 },
    { x: 6, y: 30, w: 6, h: 4 },
    { x: 12, y: 30, w: 12, h: 8 },
    { x: 0, y: 34, w: 12, h: 8 },
  ]);
  assert.equal(result.nextY, 42);
});

test('assignGridPositions honors explicit width and height', () => {
  const result = assignGridPositions([
    { type: 'timeseries', title: 'Performance Overview', w: 24, h: 10 },
    { type: 'timeseries', title: 'HTTP Request Rate' },
  ], 10);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 10, w: 24, h: 10 },
    { x: 0, y: 20, w: 12, h: 8 },
  ]);
});

test('assignGridPositions honors explicit x and y overrides', () => {
  const result = assignGridPositions([
    { type: 'stat', title: 'A', x: 6, y: 4 },
    { type: 'stat', title: 'B' },
  ], 4);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 6, y: 4, w: 6, h: 4 },
    { x: 0, y: 4, w: 6, h: 4 },
  ]);
});

test('assignGridPositions rejects overlapping explicit positions', () => {
  assert.throws(
    () => assignGridPositions([
      { type: 'stat', title: 'A' },
      { type: 'stat', title: 'B', x: 0, y: 4 },
    ], 4),
    /Explicit panel position overlaps previous panels: B/,
  );
});
