const GRID_WIDTH = 24;

export function defaultPanelSize(panel) {
  if (panel.type === 'stat') return { w: 6, h: 4 };
  if (panel.type === 'timeseries') return { w: 12, h: 8 };
  throw new Error(`Unsupported Grafana panel type: ${panel.type}`);
}

export function assignGridPositions(panelSpecs, startY) {
  const columnHeights = Array(GRID_WIDTH).fill(startY);
  const panels = [];

  for (const panel of panelSpecs) {
    const size = defaultPanelSize(panel);
    const w = panel.w ?? panel.layout?.w ?? size.w;
    const h = panel.h ?? panel.layout?.h ?? size.h;
    if (!Number.isInteger(w) || w <= 0 || w > GRID_WIDTH) {
      throw new Error(`Invalid panel width for ${panel.title}: ${w}`);
    }
    if (!Number.isInteger(h) || h <= 0) {
      throw new Error(`Invalid panel height for ${panel.title}: ${h}`);
    }

    const { x, y } = resolvePlacement(panel, columnHeights, w, startY);
    for (let i = x; i < x + w; i += 1) {
      columnHeights[i] = y + h;
    }

    panels.push({
      ...panel,
      gridPos: { x, y, w, h },
    });
  }

  return {
    panels,
    nextY: Math.max(...columnHeights),
  };
}

function resolvePlacement(panel, columnHeights, w, startY) {
  const explicitX = panel.x ?? panel.layout?.x;
  const explicitY = panel.y ?? panel.layout?.y;
  if (explicitX === undefined && explicitY === undefined) {
    return findPlacement(columnHeights, w);
  }

  if (!Number.isInteger(explicitX) || !Number.isInteger(explicitY)) {
    throw new Error(`Panel ${panel.title} must define both integer x and y when overriding layout`);
  }
  if (explicitX < 0 || explicitX + w > GRID_WIDTH || explicitY < startY) {
    throw new Error(`Invalid explicit panel position for ${panel.title}: x=${explicitX}, y=${explicitY}, w=${w}`);
  }
  if (!columnHeights.slice(explicitX, explicitX + w).every((height) => height <= explicitY)) {
    throw new Error(`Explicit panel position overlaps previous panels: ${panel.title}`);
  }

  return { x: explicitX, y: explicitY };
}

function findPlacement(columnHeights, width) {
  const candidates = [...new Set(columnHeights)].sort((a, b) => a - b);
  for (const y of candidates) {
    for (let x = 0; x <= GRID_WIDTH - width; x += 1) {
      if (columnHeights.slice(x, x + width).every((height) => height <= y)) {
        return { x, y };
      }
    }
  }

  const y = Math.min(...columnHeights);
  for (let x = 0; x <= GRID_WIDTH - width; x += 1) {
    if (columnHeights.slice(x, x + width).every((height) => height <= y)) {
      return { x, y };
    }
  }

  throw new Error(`Unable to place Grafana panel with width ${width}`);
}
