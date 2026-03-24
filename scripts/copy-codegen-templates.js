#!/usr/bin/env node
/**
 * Copy src/codegen/templates → dist/codegen/templates (tsc does not emit non-.ts files).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'codegen', 'templates');
const DEST = path.join(ROOT, 'dist', 'codegen', 'templates');

function copyRecursive(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('[WARN] copy-codegen-templates: missing', from);
    return;
  }
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      copyRecursive(path.join(from, name), path.join(to, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function main() {
  copyRecursive(SRC, DEST);
  console.log('[OK] Codegen templates → dist/codegen/templates');
}

main();
