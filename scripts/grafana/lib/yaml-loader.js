import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

export async function loadYamlFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`YAML file must contain an object: ${filePath}`);
  }
  return parsed;
}

export async function loadYamlDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')))
    .map((entry) => join(dirPath, entry.name))
    .sort();

  const documents = [];
  for (const file of files) {
    documents.push({
      file,
      document: await loadYamlFile(file),
    });
  }
  return documents;
}
