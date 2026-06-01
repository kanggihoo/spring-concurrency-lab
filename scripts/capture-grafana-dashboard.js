import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceRoot = resolve(root, 'docs/evidence');

const dashboards = {
  overview: {
    uid: 'concurrency-lab-overview',
    slug: 'concurrency-lab-overview',
  },
  phase2: {
    uid: 'concurrency-lab-overview',
    slug: 'concurrency-lab-overview',
    aliasFor: 'overview',
  },
};

const defaults = {
  dashboard: 'overview',
  baseUrl: 'http://localhost:3000',
  selector: '[data-testid="data-testid DashboardEditPaneSplitter body container"]',
  partsDir: 'docs/evidence/02-no-lock-baseline/grafana/parts',
  viewportWidth: 1600,
  viewportHeight: 965,
  waitMs: 1000,
  phase: 'phase-02',
  scenario: 'no-lock',
  preset: 'baseline',
  pool: 'default',
  uri: '$__all',
  table: '$__all',
  from: 'now-30m',
  to: 'now',
  refresh: '10s',
  live: false,
  runWindow: 'auto',
};

function parseArgs(argv) {
  const args = { ...defaults };
  const valueOptions = new Set([
    '--dashboard',
    '--base-url',
    '--selector',
    '--parts-dir',
    '--viewport-width',
    '--viewport-height',
    '--wait-ms',
    '--phase',
    '--scenario',
    '--preset',
    '--pool',
    '--uri',
    '--table',
    '--from',
    '--to',
    '--refresh',
    '--run-window',
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--live') {
      args.live = true;
      continue;
    }

    if (!valueOptions.has(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--dashboard') args.dashboard = value;
    else if (arg === '--base-url') args.baseUrl = value;
    else if (arg === '--selector') args.selector = value;
    else if (arg === '--parts-dir') args.partsDir = value;
    else if (arg === '--viewport-width') args.viewportWidth = Number(value);
    else if (arg === '--viewport-height') args.viewportHeight = Number(value);
    else if (arg === '--wait-ms') args.waitMs = Number(value);
    else if (arg === '--phase') args.phase = value;
    else if (arg === '--scenario') args.scenario = value;
    else if (arg === '--preset') args.preset = value;
    else if (arg === '--pool') args.pool = value;
    else if (arg === '--uri') args.uri = value;
    else if (arg === '--table') args.table = value;
    else if (arg === '--from') args.from = value;
    else if (arg === '--to') args.to = value;
    else if (arg === '--refresh') args.refresh = value;
    else if (arg === '--run-window') args.runWindow = value;

    i += 1;
  }

  validatePositiveNumber('--viewport-width', args.viewportWidth);
  validatePositiveNumber('--viewport-height', args.viewportHeight);
  validatePositiveNumber('--wait-ms', args.waitMs);
  return args;
}

function validatePositiveNumber(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/capture-grafana-dashboard.js [options]

Options:
  --dashboard <overview|phase2>  Dashboard to capture, phase2 is an overview compatibility alias
  --base-url <url>               Grafana base URL, default http://localhost:3000
  --selector <selector>          Dashboard scroll container selector
  --parts-dir <path>             Directory for screenshot parts
  --viewport-width <number>      Browser viewport width, default 1600
  --viewport-height <number>     Browser viewport height, default 965
  --wait-ms <number>             Wait after render/scroll, default 1000
  --phase <phase-id>             Dashboard phase variable
  --scenario <name>              Dashboard scenario variable
  --preset <name>                Dashboard preset variable
  --pool <name>                  Dashboard pool variable
  --uri <pattern>                Dashboard URI variable
  --table <pattern>              Dashboard table variable
  --from <time>                  Grafana time range start
  --to <time>                    Grafana time range end
  --refresh <value>              Grafana refresh value
  --run-window <path|auto|0>      Read Grafana from/to from k6 run-window JSON, default auto
  --live                         Allow live now-30m capture
`);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function defaultRunWindowDir(args) {
  return dirname(resolvePartsDir(args.partsDir));
}

async function resolveLatestRunWindow(args) {
  const dir = defaultRunWindowDir(args);
  if (!(await pathExists(dir))) {
    throw new Error(`No run-window directory found: ${dir}`);
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('run-window-') || !entry.name.endsWith('.json')) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    candidates.push({ path: fullPath, stats: await stat(fullPath) });
  }

  if (candidates.length === 0) {
    throw new Error(`No run-window JSON found in ${dir}. Run k6/run.sh first or pass --run-window 0 --live.`);
  }

  candidates.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  return candidates[0].path;
}

async function applyRunWindow(args) {
  if (args.runWindow === '0') {
    return args;
  }

  const runWindowPath = args.runWindow === 'auto'
    ? await resolveLatestRunWindow(args)
    : resolve(root, args.runWindow);

  const runWindow = JSON.parse(await readFile(runWindowPath, 'utf8'));
  const { grafanaFrom, grafanaTo } = runWindow;

  if (!Number.isFinite(grafanaFrom) || !Number.isFinite(grafanaTo)) {
    throw new Error(`Invalid run-window JSON, expected numeric grafanaFrom/grafanaTo: ${runWindowPath}`);
  }

  return {
    ...args,
    from: String(grafanaFrom),
    to: String(grafanaTo),
    phase: runWindow.phase || args.phase,
    scenario: runWindow.scenario || args.scenario,
    preset: runWindow.preset || args.preset,
    pool: runWindow.pool || args.pool,
    runWindowPath,
  };
}

function buildDashboardUrl(args) {
  const dashboard = dashboards[args.dashboard];
  if (!dashboard) {
    throw new Error(`Unsupported dashboard: ${args.dashboard}`);
  }

  if (!args.live && (args.from === 'now-30m' || args.to === 'now')) {
    throw new Error('Live capture requires --live. Pass explicit --from/--to for fixed evidence windows.');
  }

  const url = new URL(`/d/${dashboard.uid}/${dashboard.slug}`, args.baseUrl);
  url.searchParams.set('orgId', '1');
  url.searchParams.set('from', args.from);
  url.searchParams.set('to', args.to);
  url.searchParams.set('timezone', 'browser');
  url.searchParams.set('var-phase', args.phase);
  url.searchParams.set('var-scenario', args.scenario);
  url.searchParams.set('var-preset', args.preset);
  url.searchParams.set('var-pool', args.pool);
  url.searchParams.set('var-uri', args.uri);
  url.searchParams.set('var-table', args.table);
  url.searchParams.set('refresh', args.refresh);
  return url.toString();
}

async function wait(ms) {
  await new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function loadChromium() {
  const mod = await import('playwright');
  return mod.chromium;
}

function isPathInside(parent, child) {
  const childRelativePath = relative(parent, child);
  return childRelativePath !== '' && !childRelativePath.startsWith('..') && !isAbsolute(childRelativePath);
}

function resolvePartsDir(partsDir) {
  const resolvedPartsDir = resolve(root, partsDir);
  if (!isPathInside(evidenceRoot, resolvedPartsDir)) {
    throw new Error(`--parts-dir must resolve inside ${evidenceRoot}`);
  }
  return resolvedPartsDir;
}

function buildCaptureOffsets({ scrollHeight, clientHeight }) {
  if (scrollHeight <= clientHeight) {
    return [0];
  }

  const offsets = [];
  const maxScrollTop = scrollHeight - clientHeight;
  for (let offset = 0; offset < maxScrollTop; offset += clientHeight) {
    offsets.push(offset);
  }
  if (offsets.at(-1) !== maxScrollTop) {
    offsets.push(maxScrollTop);
  }
  return offsets;
}

async function getContainerInfo(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      scrollTop: Math.round(el.scrollTop),
      scrollHeight: Math.round(el.scrollHeight),
      clientHeight: Math.round(el.clientHeight),
      clientWidth: Math.round(el.clientWidth),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  });
}

async function capturePart({ page, selector, offset, index, partsDir, waitMs }) {
  const info = await page.locator(selector).evaluate((el, requestedOffset) => {
    el.scrollTop = requestedOffset;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
    const rect = el.getBoundingClientRect();
    return {
      requestedOffset,
      actualOffset: Math.round(el.scrollTop),
      scrollHeight: Math.round(el.scrollHeight),
      clientHeight: Math.round(el.clientHeight),
      clientWidth: Math.round(el.clientWidth),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }, offset);

  await wait(waitMs);
  validateScreenshotClip(info.rect, page.viewportSize());

  const fileName = `part-${String(index + 1).padStart(2, '0')}-scroll${info.actualOffset}.png`;
  const filePath = join(partsDir, fileName);
  await page.screenshot({ path: filePath, clip: info.rect });
  return { ...info, file: fileName };
}

function validateScreenshotClip(rect, viewport) {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || rect.x < 0 || rect.y < 0) {
    throw new Error(`Invalid screenshot clip: ${JSON.stringify(rect)}`);
  }

  if (!viewport || rect.width > viewport.width || rect.height > viewport.height) {
    throw new Error(`Screenshot clip exceeds viewport dimensions: ${JSON.stringify(rect)}`);
  }

  if (rect.x + rect.width > viewport.width || rect.y + rect.height > viewport.height) {
    throw new Error(`Screenshot clip is outside the viewport: ${JSON.stringify(rect)}`);
  }
}

async function main() {
  const args = await applyRunWindow(parseArgs(process.argv.slice(2)));
  const partsDir = resolvePartsDir(args.partsDir);
  const parentDir = dirname(partsDir);
  const tempPartsDir = join(parentDir, `.tmp-${basename(partsDir)}-${Date.now()}`);
  if (!isPathInside(evidenceRoot, tempPartsDir)) {
    throw new Error(`Temporary capture directory must resolve inside ${evidenceRoot}`);
  }
  const url = buildDashboardUrl(args);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: args.viewportWidth, height: args.viewportHeight },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator(args.selector).waitFor({ state: 'visible', timeout: 30_000 });
    await wait(args.waitMs);

    const initial = await getContainerInfo(page, args.selector);
    const offsets = buildCaptureOffsets(initial);

    await rm(tempPartsDir, { recursive: true, force: true });
    await mkdir(tempPartsDir, { recursive: true });

    const captures = [];
    for (let index = 0; index < offsets.length; index += 1) {
      captures.push(await capturePart({
        page,
        selector: args.selector,
        offset: offsets[index],
        index,
        partsDir: tempPartsDir,
        waitMs: args.waitMs,
      }));
    }

    const metadata = {
      url,
      runWindow: args.runWindowPath,
      selector: args.selector,
      dashboard: args.dashboard,
      dashboardResolved: dashboards[args.dashboard].aliasFor || args.dashboard,
      variables: {
        phase: args.phase,
        scenario: args.scenario,
        preset: args.preset,
        pool: args.pool,
        uri: args.uri,
        table: args.table,
      },
      viewport: {
        width: args.viewportWidth,
        height: args.viewportHeight,
      },
      initial,
      offsets,
      captures,
    };

    await writeFile(join(tempPartsDir, 'capture-meta.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    await rm(partsDir, { recursive: true, force: true });
    await mkdir(parentDir, { recursive: true });
    await rename(tempPartsDir, partsDir);
    console.log(`url=${url}`);
    console.log(`captures=${captures.length}`);
    console.log(`partsDir=${partsDir}`);
    console.log(`meta=${join(partsDir, 'capture-meta.json')}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
