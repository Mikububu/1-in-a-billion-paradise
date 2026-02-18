#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const SCREENS_DIR = path.join(SRC_DIR, 'screens');
const NAV_FILE = path.join(SRC_DIR, 'navigation', 'RootNavigator.tsx');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'SCREEN_DEPENDENCY_AUDIT.md');

function resolveSourceScreensDir() {
  const fromEnv = process.env.SOURCE_SCREENS_DIR;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(PROJECT_ROOT, fromEnv);
  }

  const importsDir = path.join(PROJECT_ROOT, 'runtime', 'imports');
  const candidates = [];

  const snapshot = path.join(importsDir, 'source-baseline', 'src', 'screens');
  candidates.push(snapshot);

  if (fs.existsSync(importsDir)) {
    const archived = fs
      .readdirSync(importsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('1-in-a-billion-frontend-root-'))
      .map((e) => path.join(importsDir, e.name, 'src', 'screens'))
      .sort()
      .reverse();
    candidates.push(...archived);
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    'No source screen baseline found inside V2. Set SOURCE_SCREENS_DIR or place a snapshot under runtime/imports/source-baseline/src/screens.'
  );
}

const SOURCE_SCREENS_DIR = resolveSourceScreensDir();

function walk(dir, filterFn) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, filterFn));
      continue;
    }
    if (!filterFn || filterFn(full)) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(PROJECT_ROOT, p).replaceAll(path.sep, '/');
}

function relFromScreens(p) {
  return path.relative(SCREENS_DIR, p).replaceAll(path.sep, '/');
}

function countLine(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
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

function parseNavCalls(text) {
  const calls = [];
  const routeLit = /(?:navigate|replace|push)\(\s*['"]([A-Za-z0-9_]+)['"](?:\s+as\s+any)?/g;
  for (const m of text.matchAll(routeLit)) {
    const full = m[0];
    const route = m[1];
    const kind = full.startsWith('replace') ? 'replace' : full.startsWith('push') ? 'push' : 'navigate';
    calls.push({ kind, route, line: countLine(text, m.index ?? 0) });
  }

  // Parse common reset blocks: navigation.reset({ ..., routes: [{ name: 'X' }] })
  const resetBlock = /navigation\.reset\(\s*\{[\s\S]{0,1200}?\}\s*\)/g;
  for (const blockMatch of text.matchAll(resetBlock)) {
    const block = blockMatch[0];
    const start = blockMatch.index ?? 0;
    for (const m of block.matchAll(/name:\s*['"]([A-Za-z0-9_]+)['"]/g)) {
      calls.push({ kind: 'reset', route: m[1], line: countLine(text, start + (m.index ?? 0)) });
    }
  }
  return calls;
}

function normalizeSymbol(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  s = s.replace(/\s+as\s+any/g, '').trim();
  s = s.replace(/^\(+/, '').replace(/\)+$/, '').trim();
  return s;
}

function parseRootNavigator(navText) {
  const symbolToFile = new Map();

  for (const m of navText.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]@\/screens\/([^'"]+)['"]/g)) {
    const names = m[1].split(',').map((n) => n.trim()).filter(Boolean);
    const importTarget = m[2];
    const fileImportPath = path.join(SCREENS_DIR, importTarget.endsWith('.tsx') ? importTarget : `${importTarget}.tsx`);
    const dirImportPath = path.join(SCREENS_DIR, importTarget);

    for (const raw of names) {
      const symbol = raw.split(/\s+as\s+/i)[0].trim();

      // Direct file import: @/screens/home/HomeScreen
      if (fs.existsSync(fileImportPath)) {
        symbolToFile.set(symbol, fileImportPath);
        continue;
      }

      // Barrel directory import: @/screens/settings with named symbols
      // Resolve by convention to /settings/<Symbol>.tsx when present.
      const symbolFilePath = path.join(dirImportPath, `${symbol}.tsx`);
      if (fs.existsSync(symbolFilePath)) {
        symbolToFile.set(symbol, symbolFilePath);
        continue;
      }

      // Last fallback: keep unresolved; route mapping will show unknown if no match.
    }
  }

  // Wrapper indirection in RootNavigator (e.g., SignInScreenWrapper -> SignInScreen)
  for (const m of navText.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*\([\s\S]*?<([A-Za-z0-9_]+)\s*\/>/g)) {
    const wrapper = m[1];
    const inner = m[2];
    if (symbolToFile.has(inner)) {
      symbolToFile.set(wrapper, symbolToFile.get(inner));
    }
  }

  const routes = [];
  for (const m of navText.matchAll(/<(?:OnboardingStack|MainStack)\.Screen\s+name="([A-Za-z0-9_]+)"\s+component=\{([^}]+)\}/g)) {
    const route = m[1];
    const symbol = normalizeSymbol(m[2]);
    const file = symbolToFile.get(symbol) || null;
    routes.push({ route, symbol, file });
  }

  const uniqueRouteNames = [...new Set(routes.map((r) => r.route))].sort();
  return { routes, uniqueRouteNames };
}

function classifyImports(imports) {
  const starts = (prefix) => imports.filter((i) => i.startsWith(prefix)).sort();
  return {
    services: starts('@/services/'),
    stores: starts('@/store/'),
    hooks: starts('@/hooks/'),
    contexts: starts('@/contexts/'),
    mediaImports: imports.filter((i) => i.includes('assets/') || i.startsWith('@/../assets/')).sort(),
  };
}

function compactList(items) {
  if (!items.length) return '_none_';
  return items.map((i) => `\`${i}\``).join(', ');
}

const navText = fs.readFileSync(NAV_FILE, 'utf8');
const { routes, uniqueRouteNames } = parseRootNavigator(navText);
const screenFiles = walk(SCREENS_DIR, (f) => /Screen\.tsx$/.test(f)).sort();
const sourceScreenSet = new Set(
  walk(SOURCE_SCREENS_DIR, (f) => /Screen\.tsx$/.test(f)).map((f) => path.relative(SOURCE_SCREENS_DIR, f).replaceAll(path.sep, '/'))
);

const routeByFile = new Map();
for (const r of routes) {
  if (!r.file) continue;
  const key = path.normalize(r.file);
  if (!routeByFile.has(key)) routeByFile.set(key, []);
  routeByFile.get(key).push(r.route);
}

const perFile = new Map();
for (const file of screenFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const imports = parseImports(text);
  const classes = classifyImports(imports);
  const requireMedia = parseRequireMedia(text);
  const calls = parseNavCalls(text);
  const outgoing = [...new Set(calls.map((c) => c.route))].sort();
  const unresolvedOutgoing = outgoing.filter((r) => !uniqueRouteNames.includes(r));

  perFile.set(path.normalize(file), {
    file,
    relFile: rel(file),
    relFromScreens: relFromScreens(file),
    routes: [...new Set(routeByFile.get(path.normalize(file)) || [])].sort(),
    imports,
    ...classes,
    requireMedia,
    calls,
    outgoing,
    unresolvedOutgoing,
    hasSourcePathMatch: sourceScreenSet.has(relFromScreens(file)),
  });
}

// Build incoming map from literal navigation calls
const incomingByRoute = new Map();
for (const route of uniqueRouteNames) incomingByRoute.set(route, []);
for (const [, data] of perFile) {
  for (const call of data.calls) {
    if (!incomingByRoute.has(call.route)) continue;
    incomingByRoute.get(call.route).push({
      from: data.relFile,
      line: call.line,
      kind: call.kind,
    });
  }
}

const generatedAt = new Date().toISOString();
const summary = {
  screens: screenFiles.length,
  routeEntries: routes.length,
  uniqueRoutes: uniqueRouteNames.length,
  unresolvedCalls: [...perFile.values()].reduce((acc, d) => acc + d.unresolvedOutgoing.length, 0),
  sourceMatches: [...perFile.values()].filter((d) => d.hasSourcePathMatch).length,
};

let out = '';
out += '# Screen Dependency Audit (V2)\n\n';
out += `Generated: ${generatedAt}\n\n`;
out += '## Summary\n';
out += `- V2 screens audited: ${summary.screens}\n`;
out += `- Registered route entries: ${summary.routeEntries}\n`;
out += `- Unique route names: ${summary.uniqueRoutes}\n`;
out += `- Screens with source path match: ${summary.sourceMatches}\n`;
out += `- Unresolved outgoing literal route refs: ${summary.unresolvedCalls}\n\n`;
out += 'Scope per screen: incoming callers, outgoing navigation, media refs, services/stores/hooks/contexts imports, source-path parity.\n\n';

for (const file of screenFiles) {
  const data = perFile.get(path.normalize(file));
  const incoming = [];
  for (const route of data.routes) {
    const callers = incomingByRoute.get(route) || [];
    for (const c of callers) {
      if (c.from === data.relFile) continue;
      incoming.push({ route, ...c });
    }
  }
  incoming.sort((a, b) => (a.from + a.line).localeCompare(b.from + b.line));

  out += `## \`${data.relFromScreens}\`\n`;
  out += `- Route names: ${data.routes.length ? data.routes.map((r) => `\`${r}\``).join(', ') : '_not directly registered_'}\n`;
  out += `- Source path parity: ${data.hasSourcePathMatch ? 'YES' : 'NO'}\n`;
  out += `- Incoming interactions: ${incoming.length}\n`;
  if (incoming.length) {
    out += `  - ${incoming.map((c) => `\`${c.from}:${c.line}\` via \`${c.kind}(${c.route})\``).join('\n  - ')}\n`;
  }
  out += `- Outgoing route targets: ${data.outgoing.length ? data.outgoing.map((r) => `\`${r}\``).join(', ') : '_none_'}\n`;
  if (data.unresolvedOutgoing.length) {
    out += `- Unresolved outgoing targets: ${data.unresolvedOutgoing.map((r) => `\`${r}\``).join(', ')}\n`;
  }
  out += `- Services: ${compactList(data.services)}\n`;
  out += `- Stores: ${compactList(data.stores)}\n`;
  out += `- Hooks: ${compactList(data.hooks)}\n`;
  out += `- Contexts: ${compactList(data.contexts)}\n`;
  const media = [...data.mediaImports, ...data.requireMedia];
  out += `- Media refs: ${compactList([...new Set(media)].sort())}\n\n`;
}

fs.writeFileSync(OUTPUT_FILE, out, 'utf8');
console.log(`Wrote ${rel(OUTPUT_FILE)} (${summary.screens} screens)`);
