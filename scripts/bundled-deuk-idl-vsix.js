#!/usr/bin/env node
/**
 * Bundled Deuk IDL VSIX: path, install-state under .deukpack/. Init runs this step last (after workspace bootstrap).
 * Without `--skip-vsix`: always attempt install via applyBundledVsixInstall (no Y/N prompt).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VSIX_FILE = 'deuk-idl.vsix';
const STATE_FILE = 'deuk-idl-vsix.json';

function deukpackPackageRoot() {
    return path.resolve(__dirname, '..');
}

function getBundledVsixPath() {
    return path.join(deukpackPackageRoot(), 'bundled', VSIX_FILE);
}

function readNpmDeukpackVersion() {
    try {
        const p = path.join(deukpackPackageRoot(), 'package.json');
        return JSON.parse(fs.readFileSync(p, 'utf8')).version || '';
    } catch {
        return '';
    }
}

/** @param {string} deukpackDir absolute or relative .deukpack directory */
function readVsixState(deukpackDir) {
    const p = path.join(deukpackDir, STATE_FILE);
    try {
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return null;
    }
}

function writeVsixState(deukpackDir, data) {
    fs.mkdirSync(deukpackDir, { recursive: true });
    const next = {
        schemaVersion: 1,
        ...data,
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(deukpackDir, STATE_FILE), JSON.stringify(next, null, 2), 'utf8');
}

/**
 * @returns {{ ok: boolean, command?: string }}
 */
function tryCliInstallVsix(vsixPath) {
    const tryCmds = ['code', 'cursor', 'antigravity'];
    for (const cmd of tryCmds) {
        const r = spawnSync(cmd, ['--install-extension', vsixPath], {
            shell: true,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (r.status === 0) return { ok: true, command: cmd };
    }
    return { ok: false };
}

function shouldAttemptSilentInstall(deukpackDir, currentVer) {
    const st = readVsixState(deukpackDir);
    if (!st || !st.npmPackageVersion) return true;
    if (st.npmPackageVersion !== currentVer) return true;
    return false;
}

function printManualVsixHelp(vsixPath) {
    console.log(
        '[deukpack] Bundled VSIX (install manually if needed):\n' +
            '  code --install-extension "' +
            vsixPath +
            '"\n' +
            '  antigravity --install-extension "' +
            vsixPath +
            '"\n' +
            '  Skip: DEUKPACK_SKIP_VSCODE_INSTALL=1'
    );
}

/** True if `dir` or a sibling folder under its parent looks like a Unity editor project. */
function hasUnityProjectNear(manifestBaseOut) {
    const cwd = path.resolve(manifestBaseOut);
    const candidates = [cwd];
    try {
        const parent = path.dirname(cwd);
        const entries = fs.readdirSync(parent, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const n = e.name;
            if (n === 'node_modules' || n === '.git' || n === 'Library') continue;
            candidates.push(path.join(parent, n));
        }
    } catch {
        /* ignore */
    }
    for (const r of candidates) {
        try {
            if (
                fs.existsSync(path.join(r, 'Packages', 'manifest.json')) &&
                fs.existsSync(path.join(r, 'Assets'))
            ) {
                return true;
            }
        } catch {
            /* ignore */
        }
    }
    return false;
}

/**
 * When `--skip-vsix` is not used: always attempt bundled VSIX install (no prompt; respects DEUKPACK_SKIP_VSCODE_INSTALL).
 * @param {string} manifestBaseOut project root (where .deukpack lives)
 * @param {{ hasUnityProject?: boolean }} [options] if omitted, detects Unity near manifestBaseOut
 */
async function applyBundledVsixInstall(manifestBaseOut, options = {}) {
    if (process.env.DEUKPACK_SKIP_VSCODE_INSTALL === '1') return;

    const vsixPath = getBundledVsixPath();
    if (!fs.existsSync(vsixPath)) {
        console.log('[INFO] No bundled VSIX in this deukpack tree (clone without npm pack / run npm run bundle:vscode).');
        return;
    }

    const currentVer = readNpmDeukpackVersion();
    if (!currentVer) return;

    const hasUnity =
        options.hasUnityProject !== undefined && options.hasUnityProject !== null
            ? !!options.hasUnityProject
            : hasUnityProjectNear(manifestBaseOut);

    if (hasUnity) {
        console.log(
            '[deukpack] Unity project nearby: Deuk IDL VSIX is required for the intended .deuk editor workflow.'
        );
    }

    console.log('[deukpack] Installing bundled Deuk IDL VSIX (VS Code / Cursor / Antigravity CLIs)…');
    const deukpackDir = path.join(manifestBaseOut, '.deukpack');
    const r = tryCliInstallVsix(vsixPath);
    writeVsixState(deukpackDir, {
        npmPackageVersion: currentVer,
        lastOutcome: r.ok ? 'ok' : 'failed',
    });
    if (r.ok) {
        console.log(`[deukpack] Installed bundled Deuk IDL VSIX (${r.command}).`);
        return;
    }
    printManualVsixHelp(vsixPath);
    if (hasUnity) {
        console.warn(
            '[WARN] VSIX auto-install failed. Install manually (see commands above) for Unity + .deuk tooling.'
        );
    }
}

/**
 * Optional silent install helper (legacy / tooling).
 * @param {{ initCwd: string }} opts
 */
function runPostinstallVsix(opts) {
    const initCwd = opts.initCwd;
    if (process.env.CI === 'true' || process.env.CI === '1') return;
    if (process.env.DEUKPACK_SKIP_VSCODE_INSTALL === '1') return;

    const vsixPath = getBundledVsixPath();
    if (!fs.existsSync(vsixPath)) return;

    const currentVer = readNpmDeukpackVersion();
    if (!currentVer) return;

    const deukpackDir = path.join(initCwd, '.deukpack');
    if (!shouldAttemptSilentInstall(deukpackDir, currentVer)) return;

    const r = tryCliInstallVsix(vsixPath);
    if (r.ok) {
        console.log(`[deukpack] Installed bundled Deuk IDL VSIX (${r.command}): bundled/${VSIX_FILE}`);
        writeVsixState(deukpackDir, {
            npmPackageVersion: currentVer,
            lastOutcome: 'ok',
        });
        return;
    }

    printManualVsixHelp(vsixPath);
    writeVsixState(deukpackDir, {
        npmPackageVersion: currentVer,
        lastOutcome: 'failed',
    });
}

/**
 * @param {import('readline').Interface} _rl unused (kept for call-site compatibility)
 */
async function promptBundledVsixAfterBootstrap(_rl, manifestBaseOut, options = {}) {
    await applyBundledVsixInstall(manifestBaseOut, options);
}

module.exports = {
    VSIX_FILE,
    STATE_FILE,
    getBundledVsixPath,
    readNpmDeukpackVersion,
    readVsixState,
    writeVsixState,
    tryCliInstallVsix,
    shouldAttemptSilentInstall,
    runPostinstallVsix,
    promptBundledVsixAfterBootstrap,
    applyBundledVsixInstall,
    hasUnityProjectNear,
};
