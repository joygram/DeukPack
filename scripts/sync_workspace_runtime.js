#!/usr/bin/env node
/**
 * Read `.deukpack/workspace.json` (walk up from cwd), rebuild DeukPack.Core + Protocol + ExcelProtocol
 * (netstandard2.0) via build_unity_runtime_plugins.js, then copy artifacts into Unity Plugins.
 *
 *   npx deukpack sync-runtime
 *   npx deukpack sync-runtime -c Release
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MANIFEST_REL = path.join('.deukpack', 'workspace.json');

function parseArgs(argv) {
    let configuration = 'Debug';
    let help = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') help = true;
        else if ((a === '-c' || a === '--configuration') && argv[i + 1]) configuration = argv[++i];
    }
    return { configuration, help };
}

function findManifestDir(startDir) {
    let d = path.resolve(startDir);
    const root = path.parse(d).root;
    while (d && d !== root) {
        const p = path.join(d, MANIFEST_REL);
        if (fs.existsSync(p)) return d;
        d = path.dirname(d);
    }
    return null;
}

const PLUGIN_FILES = [
    'DeukPack.Core.dll',
    'DeukPack.Core.pdb',
    'DeukPack.Protocol.dll',
    'DeukPack.Protocol.pdb',
    'DeukPack.ExcelProtocol.dll',
    'DeukPack.ExcelProtocol.pdb'
];

function runBuildAndCopy(deukPackRoot, outAbs, configuration) {
    const script = path.join(deukPackRoot, 'scripts', 'build_unity_runtime_plugins.js');
    if (!fs.existsSync(script)) {
        console.error('[ERROR] Missing', script);
        return false;
    }
    const r = spawnSync(process.execPath, [script, '--out', outAbs, '-c', configuration], {
        cwd: deukPackRoot,
        stdio: 'inherit',
        shell: false
    });
    return r.status === 0;
}

async function main(argv) {
    const opts = parseArgs(argv);
    if (opts.help) {
        console.log(`Usage: npx deukpack sync-runtime [-c Debug|Release]

Reads ${MANIFEST_REL} upward from cwd. Runs only when installKind is "src" (not package / legacy registry). Rebuilds netstandard2.0 DLLs and copies into each listed Unity Plugins folder.`);
        return;
    }

    const manifestDir = findManifestDir(process.cwd());
    if (!manifestDir) {
        console.error('[ERROR] workspace manifest not found:', MANIFEST_REL);
        process.exit(1);
    }

    const manifestPath = path.join(manifestDir, MANIFEST_REL);
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        console.error('[ERROR] Invalid JSON:', manifestPath, e.message);
        process.exit(1);
    }

    const ik = manifest.installKind;
    if (ik !== 'src') {
        console.log(
            '[INFO] installKind is not "src" — runtime copy skipped (package install).'
        );
        return;
    }

    const deukPackRoot = manifest.deukPackRoot;
    if (!deukPackRoot || !fs.existsSync(deukPackRoot)) {
        console.error('[ERROR] manifest.deukPackRoot missing or not found:', deukPackRoot);
        process.exit(1);
    }

    const projects = (manifest.unity && manifest.unity.projects) || [];
    if (projects.length === 0) {
        console.log('[INFO] No unity.projects in manifest — run `npx deukpack bootstrap` or add entries.');
        return;
    }

    const globalRel = (manifest.unity && manifest.unity.runtimePluginsOut) || 'upm/Runtime/Plugins';
    const primaryOut = path.join(deukPackRoot, ...globalRel.split(/[/\\]+/).filter(Boolean));
    const outs = [primaryOut];

    const primary = outs[0];
    if (!runBuildAndCopy(deukPackRoot, primary, opts.configuration)) process.exit(1);

    for (let i = 1; i < outs.length; i++) {
        const dest = outs[i];
        fs.mkdirSync(dest, { recursive: true });
        for (const f of PLUGIN_FILES) {
            const from = path.join(primary, f);
            const to = path.join(dest, f);
            if (!fs.existsSync(from)) continue;
            try {
                fs.copyFileSync(from, to);
            } catch (e) {
                console.warn('[WARN] Copy failed', from, '→', to, e.message);
            }
        }
        console.log('[OK] Copied plugins →', dest);
    }
}

module.exports = { main, findManifestDir };

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
