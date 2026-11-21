// Copies browser builds of our runtime dependencies out of node_modules into static/vendor/, next to their licenses.
// Generated like static/js/, never committed, so a dependency update needs nothing but the lockfile.
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const VENDOR = path.join(ROOT, 'static', 'vendor');

// Published path in static/vendor/ -> file inside node_modules/. The import map in base.html points at these
const VENDORED: Record<string, string> = {
  'fuse.min.mjs': 'fuse.js/dist/fuse.min.mjs',
  'fuse.LICENSE.txt': 'fuse.js/LICENSE',
};

function main() {
  fs.mkdirSync(VENDOR, { recursive: true });
  for (const [published, source] of Object.entries(VENDORED)) {
    fs.copyFileSync(path.join(ROOT, 'node_modules', source), path.join(VENDOR, published));
  }
}

main();
