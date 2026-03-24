#!/usr/bin/env node
/**
 * Ensure the consuming project has a valid local `deukpack` install matching package.json.
 * - Runs `npm install` to sync lockfile.
 * - Adds `deukpack` as devDependency if absent.
 * - Exits 1 if `npm ls deukpack` still reports an invalid tree (version mismatch / broken install).
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

/**
 * @param {string} cwd project root (package.json directory)
 * @param {{ nonInteractive?: boolean }} opts
 */
function ensureDeukpackNpmInstalled(cwd, opts = {}) {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        if (opts.nonInteractive) {
            console.error('[deukpack] init --non-interactive requires package.json in cwd (for npm deukpack install check).');
            process.exit(1);
        }
        console.warn('[deukpack] No package.json in cwd; skip local deukpack npm install check.');
        return;
    }

    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
        console.error('[deukpack] Invalid package.json:', e.message);
        process.exit(1);
    }

    if (pkg.name === 'deukpack') {
        console.log('[deukpack] Skipping local deukpack npm check (cwd is the deukpack package root).');
        return;
    }

    const hasDep =
        (pkg.dependencies && pkg.dependencies.deukpack) ||
        (pkg.devDependencies && pkg.devDependencies.deukpack);

    console.log('[deukpack] Syncing npm dependencies (deukpack must match package.json)…');
    try {
        execSync('npm install --no-fund --no-audit', { cwd, stdio: 'inherit' });
    } catch {
        console.error('[deukpack] npm install failed.');
        process.exit(1);
    }

    const mod = path.join(cwd, 'node_modules', 'deukpack', 'package.json');
    if (!fs.existsSync(mod)) {
        if (!hasDep) {
            console.log('[deukpack] Adding deukpack as devDependency…');
            try {
                execSync('npm install deukpack --save-dev --no-fund --no-audit', { cwd, stdio: 'inherit' });
            } catch {
                console.error('[deukpack] npm install deukpack --save-dev failed.');
                process.exit(1);
            }
        }
        if (!fs.existsSync(path.join(cwd, 'node_modules', 'deukpack', 'package.json'))) {
            console.error(
                '[deukpack] package.json lists deukpack but node_modules/deukpack is missing after npm install — fix lockfile or registry.'
            );
            process.exit(1);
        }
    }

    const ls = spawnSync('npm', ['ls', 'deukpack', '--depth=0'], {
        cwd,
        shell: true,
        encoding: 'utf8',
    });
    if (ls.status !== 0) {
        console.error(
            '[deukpack] npm ls deukpack failed — dependency tree invalid (version mismatch or peer conflict). Fix package.json / package-lock and retry.\n' +
                (ls.stderr || ls.stdout || '')
        );
        process.exit(1);
    }
}

module.exports = { ensureDeukpackNpmInstalled };
