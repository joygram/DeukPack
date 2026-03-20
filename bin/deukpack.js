#!/usr/bin/env node
/**
 * DeukPack CLI (npm global / npx).
 * Forwards to scripts/build_deukpack.js after ensuring cwd-independent resolution.
 */
const path = require('path');
const root = path.join(__dirname, '..');
process.chdir(root);
require(path.join(root, 'scripts', 'build_deukpack.js'));
