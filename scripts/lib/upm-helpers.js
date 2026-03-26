#!/usr/bin/env node
/**
 * Shared UPM helpers used by deukpack_add.js, deukpack_init.js, npm-postinstall.js.
 *
 * Responsibilities:
 *   - Locate DeukPack/upm from a working directory
 *   - Collect Unity Packages/manifest.json paths from a workspace.json structure
 *   - Write app.deukpack.runtime (and any upmDeps) into Unity manifest.json
 */

const fs = require('fs');
const path = require('path');

function readDeukPackVersion() {
    const dpPkg = path.join(__dirname, '..', '..', 'package.json');
    try {
        return JSON.parse(fs.readFileSync(dpPkg, 'utf8')).version;
    } catch {
        return null;
    }
}

/**
 * Walk up from `cwd` looking for .git or package.json as workspace root.
 */
function findWorkspaceRoot(startDir) {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    while (dir && dir !== root) {
        if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return startDir;
}

/**
 * Locate DeukPack/upm from a consumer project cwd.
 * Checks sibling of workspace root and inside workspace root.
 */
function findDeukPackUpmPath(cwd) {
    const workspaceRoot = findWorkspaceRoot(cwd);
    const candidates = [
        path.join(workspaceRoot, '..', 'DeukPack', 'upm'),
        path.join(workspaceRoot, 'DeukPack', 'upm'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'package.json'))) return c;
    }
    return null;
}

/**
 * Find DeukPack/upm from an absolute deukPackRoot recorded in workspace.json.
 */
function upmPathFromRoot(deukPackRoot) {
    if (!deukPackRoot) return null;
    const p = path.join(deukPackRoot, 'upm');
    return fs.existsSync(path.join(p, 'package.json')) ? p : null;
}

/**
 * Collect all Unity Packages/manifest.json paths from a workspace.json object.
 * Falls back to Packages/manifest.json beside the manifest dir if no projects listed.
 */
function findUnityManifestsFromWorkspace(ws, manifestDir) {
    const results = [];
    const projects = (ws && ws.unity && ws.unity.projects) || [];
    for (const p of projects) {
        const m = path.join(p.projectRoot, 'Packages', 'manifest.json');
        if (fs.existsSync(m)) results.push(m);
    }
    if (results.length === 0 && manifestDir) {
        const guess = path.join(manifestDir, 'Packages', 'manifest.json');
        if (fs.existsSync(guess)) results.push(guess);
    }
    return results;
}

/**
 * Write app.deukpack.runtime (and optionally other upmDeps) into a Unity manifest.json.
 *
 * @param {string} manifestPath  Absolute path to Packages/manifest.json
 * @param {'src'|'package'} kind
 * @param {string|null} deukPackRoot  Absolute path to DeukPack engine root (src mode)
 * @param {string|null} [version]     DeukPack version string (package mode tag)
 */
function setUpmDepInManifest(manifestPath, kind, deukPackRoot, version) {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    if (!manifest.dependencies) manifest.dependencies = {};
    const manifestDir = path.dirname(manifestPath);

    const upmPath = kind === 'src' ? upmPathFromRoot(deukPackRoot) : null;

    if (kind === 'src' && upmPath) {
        const rel = path.relative(manifestDir, upmPath).replace(/\\/g, '/');
        manifest.dependencies['app.deukpack.runtime'] = `file:${rel}`;
        console.log(`[OK] Unity manifest: app.deukpack.runtime → file:${rel}`);
    } else if (kind === 'package') {
        const ver = version || readDeukPackVersion();
        const gitUrl = `https://joygram.org/deukpack/DeukPack.git?path=upm${ver ? '#v' + ver : ''}`;
        manifest.dependencies['app.deukpack.runtime'] = gitUrl;
        console.log(`[OK] Unity manifest: app.deukpack.runtime → ${gitUrl}`);
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * Find .deukpack/workspace.json by walking up from startDir.
 * Returns the parsed object and its path, or null.
 */
function findWorkspaceManifest(startDir) {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    while (dir && dir !== root) {
        const p = path.join(dir, '.deukpack', 'workspace.json');
        if (fs.existsSync(p)) {
            try {
                return { ws: JSON.parse(fs.readFileSync(p, 'utf8')), wsDir: dir, wsPath: p };
            } catch {
                return null;
            }
        }
        dir = path.dirname(dir);
    }
    return null;
}

/**
 * Run sync (DLL build → upm/Runtime/Plugins) for src mode, then update all
 * Unity manifest.json files listed in workspace.json.
 *
 * This is the shared logic used by deukpack_init.js and npm-postinstall.js.
 */
async function runSyncAndUpmManifest(startDir) {
    const found = findWorkspaceManifest(startDir);
    if (!found) return;
    const { ws, wsDir } = found;
    const { installKind, deukPackRoot } = ws;

    if (installKind === 'src' && deukPackRoot && fs.existsSync(deukPackRoot)) {
        console.log('[deukpack] Running sync (DLL build + runtime copy)...');
        const { main: syncMain } = require('../sync_workspace_runtime.js');
        await syncMain([]);
    }

    const manifests = findUnityManifestsFromWorkspace(ws, wsDir);
    const ver = readDeukPackVersion();
    for (const m of manifests) {
        setUpmDepInManifest(m, installKind, deukPackRoot || null, ver);
    }
}

module.exports = {
    findDeukPackUpmPath,
    upmPathFromRoot,
    findUnityManifestsFromWorkspace,
    setUpmDepInManifest,
    findWorkspaceManifest,
    runSyncAndUpmManifest,
    readDeukPackVersion,
};
