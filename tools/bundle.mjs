// Minimal source-to-source ES-module bundler for Sea of Rogues.
// Concatenates all js/**/*.js files into one script, resolving static
// imports via a small runtime module registry, so the whole game runs
// as a single inline <script> (required for a single-file Artifact).
//
// Not a general bundler: it assumes this codebase's consistent style
// (named imports/exports only, relative .js specifiers, no cycles).

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

function keyOf(absPath) {
  return path.relative(JS_DIR, absPath).split(path.sep).join('/');
}

function resolveImport(fromKey, spec) {
  const dir = path.posix.dirname(fromKey);
  let resolved = path.posix.normalize(path.posix.join(dir, spec));
  if (resolved.startsWith('..')) throw new Error(`Bad import from ${fromKey}: ${spec}`);
  return resolved;
}

// The only two dynamic imports in the codebase (lazy-loaded to avoid a
// cheap circular-import worry, irrelevant once everything is bundled
// into one scope). Rewritten to plain static imports + a direct call
// before the general import/export transform runs on them.
const DYNAMIC_IMPORT_FIXUPS = [
  {
    file: 'ui/lootUI.js',
    from: `import('../render/pirate.js').then(({ drawPirate }) => {
      const ctx = el.querySelector('.recruit-face')?.getContext('2d');
      if (ctx) drawPirate(ctx, member.appearance);
    });`,
    to: `{
      const ctx = el.querySelector('.recruit-face')?.getContext('2d');
      if (ctx) drawPirate(ctx, member.appearance);
    }`,
    addImport: "import { drawPirate } from '../render/pirate.js';\n",
  },
  {
    file: 'world/dungeons.js',
    from: `import('../render/pirate.js').then(({ buildMiniCaptain }) => {
      g.drawImage(buildMiniCaptain(this.game.appearance), 0, 0);
    });`,
    to: `{
      g.drawImage(buildMiniCaptain(this.game.appearance), 0, 0);
    }`,
    addImport: "import { buildMiniCaptain } from '../render/pirate.js';\n",
  },
];

const files = listFiles(JS_DIR);
const modules = new Map(); // key -> { key, code, imports: [{names:[[orig,alias]], source}], exportNames:Set }

for (const abs of files) {
  const key = keyOf(abs);
  let code = fs.readFileSync(abs, 'utf8');

  for (const fix of DYNAMIC_IMPORT_FIXUPS) {
    if (fix.file !== key) continue;
    if (!code.includes(fix.from)) throw new Error(`Dynamic-import fixup text not found in ${key} — source must have changed.`);
    code = fix.addImport + code.replace(fix.from, fix.to);
  }

  const imports = [];

  // Multi-line and single-line named imports: import { a, b as c } from '...';
  code = code.replace(
    /import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"](\.[^'"]+)['"]\s*;?/gs,
    (_m, names, spec) => {
      const source = resolveImport(key, spec);
      const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
        const asMatch = entry.match(/^(\S+)\s+as\s+(\S+)$/);
        return asMatch ? [asMatch[1], asMatch[2]] : [entry, entry];
      });
      imports.push({ names: list, source });
      return ''; // dropped; re-emitted as destructure at top of module factory
    },
  );

  const exportNames = new Set();

  // export class Foo / export function foo / export const FOO / export let / var
  code = code.replace(/^export\s+(class|function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    exportNames.add(name);
    return `${kind} ${name}`;
  });

  // bare re-export list: export { A, B };
  code = code.replace(/^export\s*\{\s*([^}]+)\s*\}\s*;?\s*$/gm, (_m, names) => {
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) exportNames.add(n);
    return '';
  });

  // Sanity: no import(...) left after the targeted fixups above.
  if (/import\s*\(/.test(code)) throw new Error(`Unhandled dynamic import in ${key}`);

  modules.set(key, { key, code, imports, exportNames });
}

// Topological sort (DFS), cycle-safe.
const order = [];
const visited = new Set();
const visiting = new Set();
function visit(key) {
  if (visited.has(key)) return;
  if (visiting.has(key)) throw new Error(`Cycle detected at ${key}`);
  visiting.add(key);
  const mod = modules.get(key);
  if (!mod) throw new Error(`Missing module ${key}`);
  for (const imp of mod.imports) visit(imp.source);
  visiting.delete(key);
  visited.add(key);
  order.push(key);
}
for (const key of modules.keys()) visit(key);

// Emit.
let out = '(function(){\n"use strict";\nconst __M = {};\n';
for (const key of order) {
  const mod = modules.get(key);
  out += `\n__M[${JSON.stringify(key)}] = (function(){\n`;
  for (const imp of mod.imports) {
    const bindings = imp.names.map(([orig, alias]) => (orig === alias ? orig : `${orig}: ${alias}`)).join(', ');
    out += `const { ${bindings} } = __M[${JSON.stringify(imp.source)}];\n`;
  }
  out += mod.code;
  out += `\nreturn { ${[...mod.exportNames].join(', ')} };\n})();\n`;
}
out += '\n})();\n';

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/bundle.js'), out, 'utf8');
console.log('Bundled', order.length, 'modules ->', out.length, 'bytes');
console.log(order.join('\n'));
