#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const V2_SCREENS_DIR = path.join(PROJECT_ROOT, 'src', 'screens');
const SOURCE_SCREENS_DIR = path.join(PROJECT_ROOT, '..', 'ONEINABILLIONAPP', '1-in-a-billion-frontend', 'src', 'screens');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'SCREEN_PARITY_DELTA.md');

function walk(dir, filterFn) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filterFn));
    else if (!filterFn || filterFn(full)) out.push(full);
  }
  return out;
}

function relFrom(dir, file) {
  return path.relative(dir, file).replaceAll(path.sep, '/');
}

function parseImports(text) {
  const imports = [];
  for (const m of text.matchAll(/import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g)) {
    imports.push(m[1]);
  }
  return [...new Set(imports)].sort();
}

function parseRequireMedia(text) {
  const media = new Set();
  const ext = /\.(png|jpg|jpeg|gif|webp|svg|mp4|mov|mp3|m4a|wav)$/i;
  for (const m of text.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
    const target = m[2];
    if (target.includes('assets/') || ext.test(target)) media.add(target);
  }
  return [...media].sort();
}

function parseRoutes(text) {
  const routes = new Set();
  for (const m of text.matchAll(/\b(?:navigate|replace|push)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    routes.add(m[1]);
  }
  for (const m of text.matchAll(/navigation\.reset\([\s\S]{0,1200}?\)/g)) {
    const block = m[0];
    for (const r of block.matchAll(/name:\s*['"]([A-Za-z0-9_]+)['"]/g)) {
      routes.add(r[1]);
    }
  }
  return [...routes].sort();
}

function classifyDeps(imports) {
  const byPrefix = (p) => imports.filter((i) => i.startsWith(p)).sort();
  return {
    services: byPrefix('@/services/'),
    stores: byPrefix('@/store/'),
    hooks: byPrefix('@/hooks/'),
    contexts: byPrefix('@/contexts/'),
  };
}

function asSetDiff(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyA = [...setA].filter((x) => !setB.has(x)).sort();
  const onlyB = [...setB].filter((x) => !setA.has(x)).sort();
  return { onlyA, onlyB };
}

function block(title, list) {
  if (!list.length) return '';
  return `- ${title}: ${list.map((x) => `\`${x}\``).join(', ')}\n`;
}

const v2Files = walk(V2_SCREENS_DIR, (f) => /Screen\.tsx$/.test(f));
const sourceFiles = walk(SOURCE_SCREENS_DIR, (f) => /Screen\.tsx$/.test(f));
const sourceByRel = new Map(sourceFiles.map((f) => [relFrom(SOURCE_SCREENS_DIR, f), f]));

const compared = [];
const missingInSource = [];
for (const v2File of v2Files) {
  const rel = relFrom(V2_SCREENS_DIR, v2File);
  const sourceFile = sourceByRel.get(rel);
  if (!sourceFile) {
    missingInSource.push(rel);
    continue;
  }

  const v2Text = fs.readFileSync(v2File, 'utf8');
  const sourceText = fs.readFileSync(sourceFile, 'utf8');

  const v2Imports = parseImports(v2Text);
  const sourceImports = parseImports(sourceText);
  const v2Media = [...new Set([...parseRequireMedia(v2Text), ...v2Imports.filter((i) => i.includes('assets/'))])].sort();
  const sourceMedia = [...new Set([...parseRequireMedia(sourceText), ...sourceImports.filter((i) => i.includes('assets/'))])].sort();

  const v2Deps = classifyDeps(v2Imports);
  const sourceDeps = classifyDeps(sourceImports);

  const serviceDiff = asSetDiff(v2Deps.services, sourceDeps.services);
  const storeDiff = asSetDiff(v2Deps.stores, sourceDeps.stores);
  const hookDiff = asSetDiff(v2Deps.hooks, sourceDeps.hooks);
  const contextDiff = asSetDiff(v2Deps.contexts, sourceDeps.contexts);
  const mediaDiff = asSetDiff(v2Media, sourceMedia);
  const routeDiff = asSetDiff(parseRoutes(v2Text), parseRoutes(sourceText));

  const lineDelta = v2Text.split('\n').length - sourceText.split('\n').length;

  const hasDelta =
    lineDelta !== 0 ||
    serviceDiff.onlyA.length || serviceDiff.onlyB.length ||
    storeDiff.onlyA.length || storeDiff.onlyB.length ||
    hookDiff.onlyA.length || hookDiff.onlyB.length ||
    contextDiff.onlyA.length || contextDiff.onlyB.length ||
    mediaDiff.onlyA.length || mediaDiff.onlyB.length ||
    routeDiff.onlyA.length || routeDiff.onlyB.length;

  if (!hasDelta) continue;

  compared.push({
    rel,
    lineDelta,
    serviceDiff,
    storeDiff,
    hookDiff,
    contextDiff,
    mediaDiff,
    routeDiff,
  });
}

compared.sort((a, b) => a.rel.localeCompare(b.rel));
missingInSource.sort();

let out = '';
out += '# Screen Parity Delta (Source -> V2)\n\n';
out += `Generated: ${new Date().toISOString()}\n\n`;
out += '## Summary\n';
out += `- V2 screens: ${v2Files.length}\n`;
out += `- Source screens: ${sourceFiles.length}\n`;
out += `- Path-matched screens compared: ${v2Files.length - missingInSource.length}\n`;
out += `- V2-only screens (no source path match): ${missingInSource.length}\n`;
out += `- Matched screens with dependency/navigation deltas: ${compared.length}\n\n`;

if (missingInSource.length) {
  out += '## V2-only screens\n';
  for (const rel of missingInSource) out += `- \`${rel}\`\n`;
  out += '\n';
}

out += '## Deltas by screen\n';
if (!compared.length) {
  out += '- No deltas detected for path-matched screens.\n';
} else {
  for (const d of compared) {
    out += `\n### \`${d.rel}\`\n`;
    out += `- Line delta (V2 - source): ${d.lineDelta}\n`;
    out += block('Services added in V2', d.serviceDiff.onlyA);
    out += block('Services removed from source', d.serviceDiff.onlyB);
    out += block('Stores added in V2', d.storeDiff.onlyA);
    out += block('Stores removed from source', d.storeDiff.onlyB);
    out += block('Hooks added in V2', d.hookDiff.onlyA);
    out += block('Hooks removed from source', d.hookDiff.onlyB);
    out += block('Contexts added in V2', d.contextDiff.onlyA);
    out += block('Contexts removed from source', d.contextDiff.onlyB);
    out += block('Media refs added in V2', d.mediaDiff.onlyA);
    out += block('Media refs removed from source', d.mediaDiff.onlyB);
    out += block('Outgoing routes added in V2', d.routeDiff.onlyA);
    out += block('Outgoing routes removed from source', d.routeDiff.onlyB);
  }
}

fs.writeFileSync(OUTPUT_FILE, out, 'utf8');
console.log(`Wrote ${path.relative(PROJECT_ROOT, OUTPUT_FILE)} (${compared.length} delta screens)`);
