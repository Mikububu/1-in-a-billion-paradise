#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const NAV_FILE = path.join(SRC_DIR, 'navigation', 'RootNavigator.tsx');
const SCREENS_DIR = path.join(SRC_DIR, 'screens');

function walk(dir, filterFn) {
  const out = [];
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

const tsFiles = walk(SRC_DIR, (f) => /\.(ts|tsx)$/.test(f));
const screenFiles = walk(SCREENS_DIR, (f) => /Screen\.tsx$/.test(f));
const navText = fs.readFileSync(NAV_FILE, 'utf8');

const registeredRoutes = [...new Set([...navText.matchAll(/name="([A-Za-z0-9_]+)"/g)].map((m) => m[1]))].sort();
const routeRegistrations = [...navText.matchAll(/name="([A-Za-z0-9_]+)"/g)].length;

const unresolvedCalls = [];
for (const file of tsFiles) {
  if (!file.includes(`${path.sep}screens${path.sep}`)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\b(?:navigate|replace|push)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    const route = match[1];
    if (!registeredRoutes.includes(route)) {
      unresolvedCalls.push(`${rel(file)} -> ${route}`);
    }
  }
}

const unreferencedScreens = [];
for (const screenFile of screenFiles) {
  const baseName = path.basename(screenFile, '.tsx');
  let refs = 0;
  const importRegex = new RegExp(`(from|export\\s+\\*)\\s+['"][^'"]*${baseName}['"]`, 'g');
  for (const file of tsFiles) {
    if (file === screenFile) continue;
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(importRegex);
    if (matches) refs += matches.length;
  }
  if (refs === 0) {
    unreferencedScreens.push(rel(screenFile));
  }
}

const routeCallerCounts = new Map();
for (const route of registeredRoutes) {
  routeCallerCounts.set(route, 0);
}

for (const file of tsFiles) {
  if (file === NAV_FILE) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const route of registeredRoutes) {
    const patterns = [
      new RegExp(`navigate\\(\\s*['"]${route}['"]`, 'g'),
      new RegExp(`replace\\(\\s*['"]${route}['"]`, 'g'),
      new RegExp(`push\\(\\s*['"]${route}['"]`, 'g'),
      new RegExp(`name\\s*:\\s*['"]${route}['"]`, 'g'),
    ];
    for (const re of patterns) {
      const matches = text.match(re);
      if (matches) {
        routeCallerCounts.set(route, routeCallerCounts.get(route) + matches.length);
      }
    }
  }
}

const zeroCallerRoutes = [...routeCallerCounts.entries()]
  .filter(([, count]) => count === 0)
  .map(([route]) => route);

console.log('Screen Wiring Audit');
console.log(`- Screen files: ${screenFiles.length}`);
console.log(`- Route entries: ${routeRegistrations}`);
console.log(`- Unique route names: ${registeredRoutes.length}`);
console.log(`- Unresolved navigation calls: ${unresolvedCalls.length}`);
console.log(`- Unreferenced screen files: ${unreferencedScreens.length}`);
console.log(`- Routes with zero external callers: ${zeroCallerRoutes.length}`);

if (unresolvedCalls.length) {
  console.log('\nUnresolved navigation calls:');
  for (const line of unresolvedCalls) console.log(`  - ${line}`);
}

if (unreferencedScreens.length) {
  console.log('\nUnreferenced screen files:');
  for (const file of unreferencedScreens) console.log(`  - ${file}`);
}

if (zeroCallerRoutes.length) {
  console.log('\nRoutes with zero external callers:');
  for (const route of zeroCallerRoutes) console.log(`  - ${route}`);
}

if (unresolvedCalls.length || unreferencedScreens.length) {
  process.exitCode = 1;
}
