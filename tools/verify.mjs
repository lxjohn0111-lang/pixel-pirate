// Cross-check every import against the target module's detected export
// set, so a silently-undefined destructure (JS doesn't throw on that)
// gets caught before runtime.
import fs from 'node:fs';
import path from 'node:path';

// The repo root, derived from this file's location so the build works
// from any checkout.
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JS_DIR = path.join(ROOT, 'js');

function listFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(listFiles(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}
function keyOf(abs) {
  return path.relative(JS_DIR, abs).split(path.sep).join('/');
}
function resolveImport(fromKey, spec) {
  const dir = path.posix.dirname(fromKey);
  return path.posix.normalize(path.posix.join(dir, spec));
}

const files = listFiles(JS_DIR);
const exportsByFile = new Map();
const importsByFile = new Map();

for (const abs of files) {
  const key = keyOf(abs);
  let code = fs.readFileSync(abs, 'utf8');
  const exportNames = new Set();
  const re1 = /^export\s+(?:class|function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re1.exec(code))) exportNames.add(m[1]);
  const re2 = /^export\s*\{\s*([^}]+)\s*\}\s*;?\s*$/gm;
  while ((m = re2.exec(code))) for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) exportNames.add(n);
  exportsByFile.set(key, exportNames);

  const imports = [];
  const re3 = /import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"](\.[^'"]+)['"]\s*;?/gs;
  while ((m = re3.exec(code))) {
    const source = resolveImport(key, m[2]);
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((e) => {
      const am = e.match(/^(\S+)\s+as\s+(\S+)$/);
      return am ? am[1] : e;
    });
    imports.push({ source, names });
  }
  importsByFile.set(key, imports);
}

let problems = 0;
for (const [key, imports] of importsByFile) {
  for (const { source, names } of imports) {
    const target = exportsByFile.get(source);
    if (!target) {
      console.log(`MISSING MODULE: ${key} imports from '${source}' which was not found`);
      problems++;
      continue;
    }
    for (const n of names) {
      if (!target.has(n)) {
        console.log(`MISSING EXPORT: ${key} imports '${n}' from '${source}', but that module only exports [${[...target].join(', ')}]`);
        problems++;
      }
    }
  }
}
console.log(problems === 0 ? 'ALL IMPORTS RESOLVE CLEANLY' : `${problems} PROBLEM(S) FOUND`);
