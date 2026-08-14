// Build the CrazyGames upload: one self-contained index.html.
//
// The multi-file game is the nicer thing to work on, but it is the worse
// thing to hand to a portal. Loose `css/` and `js/` folders can end up
// somewhere other than where index.html looks for them, and a host that
// serves .js with the wrong content type refuses `type="module"`
// outright. Either one is a white screen with no error the uploader can
// see.
//
// So the shipped build is a single document with the stylesheet and the
// whole game inlined, and nothing to fetch but the CrazyGames SDK. There
// is no folder to misplace and no module MIME type to get wrong.
//
// Usage, from the repo root:
//   node tools/bundle.mjs && node tools/verify.mjs && node tools/build-crazygames.mjs
// Then zip the single file in dist/ — index.html must be at the ZIP root.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const bundle = fs.readFileSync(path.join(ROOT, 'dist/bundle.js'), 'utf8');

// The bundler emits a plain script (its own module registry), not an ES
// module, so this needs no type attribute — which is exactly what makes
// it immune to a host serving the wrong MIME type.
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="description" content="Sea of Rogues — an infinite pixel-art pirate sailing adventure.">
<title>Sea of Rogues</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#127988;&#8205;&#9760;&#65039;</text></svg>">
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
<style>
${css}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div id="ui"></div>
<div id="vignette"></div>
<script>
${bundle}
</script>
</body>
</html>
`;

const out = path.join(ROOT, 'dist/index.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out, `(${(html.length / 1024).toFixed(0)} KB)`);
