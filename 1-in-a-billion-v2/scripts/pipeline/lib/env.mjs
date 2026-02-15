import fs from 'node:fs';
import path from 'node:path';

function parseDotEnv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!key) continue;

    // Remove surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadEnvFromRepoRoot({ repoRoot, fileNames = ['.env.local', '.env'] } = {}) {
  const root = repoRoot || path.resolve(process.cwd());
  for (const fileName of fileNames) {
    const p = path.join(root, fileName);
    if (!fs.existsSync(p)) continue;
    const vars = parseDotEnv(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(vars)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

