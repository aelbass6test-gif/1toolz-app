#!/usr/bin/env node
/**
 * Read-only inventory of active Firebase SDK references.
 *
 * Usage:
 *   npm run audit:firebase
 *   npm run audit:firebase -- --strict
 *
 * Default mode reports remaining dependencies without failing, which is useful
 * during a phased migration. --strict exits non-zero while any Firebase
 * reference remains, and is intended for the final Firebase retirement gate.
 * This script never reads environment files, credentials, backups, or record data.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next',
  'archive', 'archives', 'tmp', 'backups', 'data'
]);
const IGNORED_FILES = new Set([
  'audit_firebase_references.mjs',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'
]);

const CHECKS = [
  ['firebase-client-import', /(?:from\s*|import\s*)['"](?:\.\/|\.\.\/)*services\/firebaseClient['"]/],
  ['firebase-sdk-import', /(?:from\s*|import\s*)['"]firebase\/(?:auth|firestore|app|storage|functions|database|messaging|analytics)(?:\/[^'"]*)?['"]/],
  ['firebase-admin-import', /['"]firebase-admin(?:\/[^'"]*)?['"]/],
  ['firebase-auth-api', /\b(?:signInWithEmailAndPassword|createUserWithEmailAndPassword|signInWithCustomToken|signInAnonymously|onAuthStateChanged|getAuth)\s*\(/],
  ['firestore-api', /\b(?:onSnapshot|getFirestore|getDocs|getDoc|setDoc|addDoc|updateDoc|deleteDoc|runTransaction)\s*\(/],
  ['legacy-auth-alias', /@mystore-auth\.app/],
  ['firebase-config', /(?:firebaseConfig|initializeApp\s*\(\s*\{)/]
];

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(path.join(directory, entry.name), files);
      continue;
    }
    if (!entry.isFile() || IGNORED_FILES.has(entry.name)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (SOURCE_EXTENSIONS.has(extension)) files.push(path.join(directory, entry.name));
  }
  return files;
}

const findings = [];

// The package manifest is a retirement dependency too, even after source imports disappear.
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const dependency of Object.keys(manifest[section] || {})) {
      if (dependency === 'firebase' || dependency === 'firebase-admin' || dependency.startsWith('@firebase/')) {
        findings.push({ file: 'package.json', line: 1, category: `package-dependency:${dependency}` });
      }
    }
  }
} catch {
  console.warn('Could not inspect package.json for Firebase dependencies.');
}

for (const configFile of ['firebase.json', '.firebaserc', 'firestore.rules', 'firestore.indexes.json']) {
  if (fs.existsSync(path.join(ROOT, configFile))) {
    findings.push({ file: configFile, line: 1, category: 'firebase-config-artifact' });
  }
}

for (const file of walk(ROOT)) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const [category, pattern] of CHECKS) {
      if (pattern.test(lines[index])) {
        findings.push({
          file: path.relative(ROOT, file).split(path.sep).join('/'),
          line: index + 1,
          category
        });
      }
    }
  }
}

const byFile = new Map();
for (const finding of findings) {
  const current = byFile.get(finding.file) || [];
  current.push(finding);
  byFile.set(finding.file, current);
}

console.log('Firebase reference audit (read-only)');
console.log(`Scanned source files: ${walk(ROOT).length}`);
console.log(`Files with Firebase references: ${byFile.size}`);
console.log(`Reference matches: ${findings.length}`);
for (const [file, matches] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const locations = matches.map(item => `${item.line}:${item.category}`).join(', ');
  console.log(`- ${file}: ${locations}`);
}

if (findings.length > 0) {
  console.log('\nFirebase is still referenced. Keep the SDK and configuration until each path is migrated and verified.');
} else {
  console.log('\nNo Firebase references were detected by this scanner. Complete a manual review before removing Firebase configuration.');
}

if (STRICT && findings.length > 0) process.exitCode = 1;
