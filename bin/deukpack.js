#!/usr/bin/env node
/**
 * DeukPack CLI (npm global / npx).
 * Forwards to scripts/build_deukpack.js after ensuring cwd-independent resolution.
 */
const path = require('path');
const { main } = require(path.join(__dirname, '..', 'scripts', 'build_deukpack.js'));
main().catch(console.error);
