#!/usr/bin/env node
/**
 * DeukPack Add - 패밀리 패키지 설치 (navigation, serverkit)
 *
 * Usage:
 *   npx deukpack add navigation [--kind src|package]
 *   npx deukpack add serverkit [--kind src|package]
 *   npx deukpack add navigation,serverkit --kind src
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { findDeukPackUpmPath, setUpmDepInManifest, readDeukPackVersion } = require('./lib/upm-helpers.js');

const FAMILY_PACKAGES = {
    navigation: {
        name: 'deuknavigation',
        npmName: 'deuknavigation',
        displayName: 'DeukNavigation',
        srcFolder: 'DeukNavigation',
        gitUrl: 'https://joygram.org/deukpack/DeukNavigation.git',
        upmName: 'app.deukpack.deuk-navigation',
        upmDeps: ['app.deukpack.runtime']
    },
    serverkit: {
        name: 'deukserverkit',
        npmName: 'deukserverkit',
        displayName: 'DeukServerKit',
        srcFolder: 'DeukServerKit',
        gitUrl: 'https://joygram.org/deukpack/DeukServerKit.git',
        upmDeps: ['app.deukpack.runtime']
    }
};

function parseArgs(argv) {
    let packages = [];
    let kind = 'src'; // default to src
    let help = false;

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            help = true;
        } else if (a === '--kind' && argv[i + 1]) {
            kind = argv[++i].toLowerCase();
        } else if (!a.startsWith('-')) {
            const pkgs = a.split(',').map((p) => p.trim().toLowerCase());
            packages.push(...pkgs);
        }
    }

    return { packages, kind, help };
}

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

function findSiblingSource(cwd, srcFolder) {
    const workspaceRoot = findWorkspaceRoot(cwd);
    const parent = path.dirname(workspaceRoot);

    const siblingPath = path.join(parent, srcFolder);
    if (fs.existsSync(siblingPath) && fs.existsSync(path.join(siblingPath, 'package.json'))) {
        return siblingPath;
    }

    const inWorkspace = path.join(workspaceRoot, '..', srcFolder);
    if (fs.existsSync(inWorkspace) && fs.existsSync(path.join(inWorkspace, 'package.json'))) {
        return inWorkspace;
    }

    return null;
}

function updatePackageJson(cwd, pkgName, version, { devDependencies } = {}) {
    const pkgJsonPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
        console.error('[ERROR] No package.json found in', cwd);
        console.error('Run: npm init -y');
        return false;
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (devDependencies) {
        if (!pkgJson.devDependencies) pkgJson.devDependencies = {};
        pkgJson.devDependencies[pkgName] = version;
    } else {
        if (!pkgJson.dependencies) pkgJson.dependencies = {};
        pkgJson.dependencies[pkgName] = version;
    }

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4) + '\n', 'utf8');
    return true;
}

function runNpmInstallDeukPack(cwd) {
    console.log('[INFO] Installing deukpack...');
    const result = spawnSync('npm', ['install', '--save-dev', 'deukpack'], {
        cwd,
        stdio: 'inherit',
        shell: true
    });
    return result.status === 0;
}

function updateWorkspaceJson(cwd, pkgInfo, kind, srcPath) {
    const deukpackDir = path.join(cwd, '.deukpack');
    const workspaceJsonPath = path.join(deukpackDir, 'workspace.json');

    let workspace = { schemaVersion: 1, installKind: kind };

    if (fs.existsSync(workspaceJsonPath)) {
        workspace = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
    } else {
        fs.mkdirSync(deukpackDir, { recursive: true });
    }

    if (!workspace.family) {
        workspace.family = {};
    }

    workspace.family[pkgInfo.name] = {
        installKind: kind,
        ...(kind === 'src' && srcPath ? { srcRoot: path.normalize(srcPath) } : {})
    };

    fs.writeFileSync(workspaceJsonPath, JSON.stringify(workspace, null, 2) + '\n', 'utf8');
    console.log(`[OK] Updated .deukpack/workspace.json with ${pkgInfo.displayName}`);
}

function readDeukPackVersionLocal() {
    return readDeukPackVersion();
}

function findUnityManifests(cwd) {
    const results = [];
    const workspaceRoot = findWorkspaceRoot(cwd);
    const deukpackJson = path.join(workspaceRoot, '.deukpack', 'workspace.json');
    if (fs.existsSync(deukpackJson)) {
        try {
            const ws = JSON.parse(fs.readFileSync(deukpackJson, 'utf8'));
            const projects = (ws.unity && ws.unity.projects) || [];
            for (const p of projects) {
                const manifest = path.join(p.projectRoot, 'Packages', 'manifest.json');
                if (fs.existsSync(manifest)) results.push(manifest);
            }
        } catch {
            /* ignore */
        }
    }
    if (results.length === 0) {
        const guess = path.join(workspaceRoot, 'Packages', 'manifest.json');
        if (fs.existsSync(guess)) results.push(guess);
    }
    return results;
}

function updateUnityManifest(manifestPath, pkgInfo, kind, srcPath) {
    const hasUpm = pkgInfo.upmName || (pkgInfo.upmDeps && pkgInfo.upmDeps.length);
    if (!hasUpm) return;
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    if (!manifest.dependencies) manifest.dependencies = {};
    const manifestDir = path.dirname(manifestPath);

    // Family package upmName (e.g. app.deukpack.deuk-navigation)
    if (pkgInfo.upmName) {
        if (kind === 'src' && srcPath) {
            const rel = path.relative(manifestDir, srcPath).replace(/\\/g, '/');
            manifest.dependencies[pkgInfo.upmName] = `file:${rel}`;
            console.log(`[OK] Unity manifest: ${pkgInfo.upmName} → file:${rel}`);
        } else if (kind === 'package' && pkgInfo.gitUrl) {
            const ver = readDeukPackVersion();
            const tag = ver ? `#v${ver}` : '';
            manifest.dependencies[pkgInfo.upmName] = `${pkgInfo.gitUrl}${tag}`;
            console.log(`[OK] Unity manifest: ${pkgInfo.upmName} → ${manifest.dependencies[pkgInfo.upmName]}`);
        }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    // upmDeps (e.g. app.deukpack.runtime) — delegated to upm-helpers
    if (pkgInfo.upmDeps && pkgInfo.upmDeps.includes('app.deukpack.runtime')) {
        const deukPackRoot = kind === 'src' ? (() => {
            const upmPath = findDeukPackUpmPath(path.dirname(manifestDir));
            return upmPath ? path.dirname(upmPath) : null;
        })() : null;
        setUpmDepInManifest(manifestPath, kind, deukPackRoot, readDeukPackVersion());
    }
}

async function addPackage(cwd, pkgKey, kind) {
    const pkgInfo = FAMILY_PACKAGES[pkgKey];
    if (!pkgInfo) {
        console.error(`[ERROR] Unknown package: ${pkgKey}`);
        console.error('Available packages:', Object.keys(FAMILY_PACKAGES).join(', '));
        return false;
    }

    console.log(`\n[ADD] ${pkgInfo.displayName} (${kind} mode)`);

    let version;
    let srcPath = null;

    if (kind === 'src') {
        srcPath = findSiblingSource(cwd, pkgInfo.srcFolder);

        if (srcPath) {
            const relativePath = path.relative(cwd, srcPath);
            version = `file:${relativePath.replace(/\\/g, '/')}`;
            console.log(`[OK] Found source at: ${srcPath}`);
        } else {
            console.error(`[ERROR] Source not found for ${pkgInfo.displayName}`);
            console.error(`Expected at: ../${pkgInfo.srcFolder}`);
            console.error(`\nTo use source mode, clone the repository:`);
            console.error(`  git clone ${pkgInfo.gitUrl} ../${pkgInfo.srcFolder}`);
            console.error(`\nOr use package mode:`);
            console.error(`  npx deukpack add ${pkgKey} --kind package`);
            return false;
        }
    } else {
        version = 'latest';
        console.log(`[INFO] Will install from npm registry`);
    }

    if (!updatePackageJson(cwd, pkgInfo.npmName, version)) {
        return false;
    }
    console.log(`[OK] Added ${pkgInfo.npmName}: ${version} to package.json`);

    if (kind === 'src') {
        const deukPackSrc = findSiblingSource(cwd, 'DeukPack');
        if (deukPackSrc) {
            const relDp = path.relative(cwd, deukPackSrc).replace(/\\/g, '/');
            updatePackageJson(cwd, 'deukpack', `file:${relDp}`, { devDependencies: true });
            console.log(`[OK] deukpack (CLI) → file:${relDp} (devDependencies)`);
            const r = spawnSync('npm', ['install', '--save-dev', `deukpack@file:${relDp}`], {
                cwd, stdio: 'inherit', shell: true
            });
            if (r.status !== 0) console.warn('[WARN] deukpack local install failed — run manually: npm install --save-dev deukpack@file:../DeukPack');
        } else {
            console.warn('[WARN] DeukPack source not found as sibling — npx deukpack will use npm registry version');
        }
    } else {
        if (!runNpmInstallDeukPack(cwd)) {
            console.error('[WARN] npm install failed, run manually: npm install --save-dev deukpack');
        }
    }

    updateWorkspaceJson(cwd, pkgInfo, kind, srcPath);

    if (pkgInfo.upmName || (pkgInfo.upmDeps && pkgInfo.upmDeps.length)) {
        const manifests = findUnityManifests(cwd);
        for (const m of manifests) {
            updateUnityManifest(m, pkgInfo, kind, srcPath);
        }
    }

    console.log(`[OK] ${pkgInfo.displayName} added successfully`);
    return true;
}

async function main(argv) {
    const opts = parseArgs(argv);

    if (opts.help || opts.packages.length === 0) {
        console.log(`DeukPack Add - Install family packages

Usage:
  npx deukpack add <package> [--kind src|package]
  npx deukpack add navigation,serverkit --kind src

Packages:
  navigation    DeukNavigation (Unity navmesh sync)
  serverkit     DeukServerKit (C# server library)

Options:
  --kind src      Use source from sibling folder (default)
  --kind package  Install from npm registry

Examples:
  npx deukpack add navigation --kind src
  npx deukpack add serverkit --kind src
  npx deukpack add navigation,serverkit --kind src
`);
        return;
    }

    const cwd = process.cwd();
    let success = true;

    for (const pkg of opts.packages) {
        const result = await addPackage(cwd, pkg, opts.kind);
        if (!result) {
            success = false;
        }
    }

    if (success) {
        console.log('\n[DONE] All packages added successfully');
    } else {
        console.log('\n[WARN] Some packages failed to add');
        process.exit(1);
    }
}

module.exports = { main, FAMILY_PACKAGES };

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
