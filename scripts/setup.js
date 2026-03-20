#!/usr/bin/env node
/**
 * DeukPack (core) — 공통 초기 설정 (OS 공통)
 * 1) Node 16+ 검사  2) npm install  3) npm run build
 * Usage: node scripts/setup.js [--skip-build]
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const NODE_MIN_MAJOR = 16;

function getNodeMajor() {
    const v = process.version;
    const match = v.match(/^v?(\d+)\./);
    return match ? parseInt(match[1], 10) : 0;
}

function checkNode() {
    const major = getNodeMajor();
    if (major === 0) {
        console.error('[setup] Could not parse Node version:', process.version);
        process.exit(1);
    }
    if (major < NODE_MIN_MAJOR) {
        console.error('[setup] Node.js ' + NODE_MIN_MAJOR + '+ required; current: ' + process.version);
        process.exit(1);
    }
    console.log('[setup] Node.js ' + process.version + ' OK');
}

function npmInstall() {
    console.log('[setup] Installing dependencies (npm install)...');
    execSync('npm install', { cwd: root, stdio: 'inherit' });
}

function npmBuild() {
    console.log('[setup] Building (npm run build)...');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

function main() {
    const skipBuild = process.argv.includes('--skip-build');

    checkNode();
    npmInstall();
    if (!skipBuild) {
        npmBuild();
    } else {
        console.log('[setup] Skipping build (--skip-build).');
    }
    console.log('[setup] Done. Run: npx deukpack --help');
}

main();
