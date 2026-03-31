#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function main() {
    const result = spawnSync('node', ['scripts/test-e2e-roundtrip-chain.js'], {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

main();
