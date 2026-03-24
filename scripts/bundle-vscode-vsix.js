#!/usr/bin/env node
/**
 * Packs vscode-extension into bundled/deuk-idl.vsix for npm tarball.
 * Temporarily sets extension package.json version to root deukpack version (restored after pack).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'vscode-extension');
const extPkgPath = path.join(extDir, 'package.json');
const bundledDir = path.join(root, 'bundled');
const vsixPath = path.join(bundledDir, 'deuk-idl.vsix');

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const extPkg = JSON.parse(fs.readFileSync(extPkgPath, 'utf8'));
const savedVer = extPkg.version;
extPkg.version = rootPkg.version;
fs.writeFileSync(extPkgPath, JSON.stringify(extPkg, null, 2) + '\n');

try {
  if (!fs.existsSync(bundledDir)) fs.mkdirSync(bundledDir, { recursive: true });
  execSync('npm install', { cwd: extDir, stdio: 'inherit' });
  execSync('npm run compile', { cwd: extDir, stdio: 'inherit' });
  const vsceBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vsce.cmd' : 'vsce');
  if (!fs.existsSync(vsceBin)) {
    console.error('[deukpack] @vscode/vsce missing. Run npm install at DeukPack repo root.');
    process.exit(1);
  }
  const q = (s) => (s.includes(' ') ? `"${s.replace(/"/g, '\\"')}"` : s);
  execSync(`${q(vsceBin)} package --no-dependencies --out ${q(vsixPath)}`, {
    cwd: extDir,
    stdio: 'inherit',
    shell: true,
  });
  if (!fs.existsSync(vsixPath)) {
    console.error('[deukpack] bundle-vscode: expected VSIX missing:', vsixPath);
    process.exit(1);
  }
  console.log('[deukpack] bundled VS Code extension:', vsixPath);
} finally {
  extPkg.version = savedVer;
  fs.writeFileSync(extPkgPath, JSON.stringify(extPkg, null, 2) + '\n');
}
