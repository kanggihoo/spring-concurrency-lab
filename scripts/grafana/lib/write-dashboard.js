import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export async function writeDashboard({ root, dashboardsDir, output, dashboard }) {
  if (!output || output.includes('/') || output.includes('\\')) {
    throw new Error(`Dashboard output must be a file name: ${output}`);
  }

  const outputPath = resolve(dashboardsDir, output);
  if (!isPathInside(dashboardsDir, outputPath)) {
    throw new Error(`Dashboard output must resolve inside ${dashboardsDir}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Generated ${relative(root, outputPath)}`);
}

function isPathInside(parent, child) {
  const childRelativePath = relative(parent, child);
  return childRelativePath === '' || (!childRelativePath.startsWith('..') && !isAbsolute(childRelativePath));
}

export function outputPathFor({ dashboardsDir, output }) {
  return join(dashboardsDir, output);
}
