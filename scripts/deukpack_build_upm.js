#!/usr/bin/env node
/**
 * npx deukpack build-upm [-c Release] [--tarball]
 *
 * 1. Build Protocol + ExcelProtocol DLLs → upm/Runtime/Plugins/
 * 2. Strip -dev from upm/package.json version
 * 3. Optionally create tarball
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UPM_DIR = path.join(ROOT, 'upm');
const PLUGINS_DIR = path.join(UPM_DIR, 'Runtime', 'Plugins');

function parseArgs(argv) {
    let configuration = 'Release';
    let tarball = false;
    let help = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') help = true;
        else if ((a === '-c' || a === '--configuration') && argv[i + 1]) configuration = argv[++i];
        else if (a === '--tarball') tarball = true;
    }
    return { configuration, tarball, help };
}

function main(argv) {
    const opts = parseArgs(argv || []);
    if (opts.help) {
        console.log('Usage: npx deukpack build-upm [-c Release|Debug] [--tarball]');
        process.exit(0);
    }

    // 1. Build DLLs
    const buildScript = path.join(ROOT, 'scripts', 'build_unity_runtime_plugins.js');
    console.log(`[build-upm] Building DLLs (${opts.configuration})...`);
    const r = spawnSync(process.execPath, [buildScript, '--out', PLUGINS_DIR, '-c', opts.configuration], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: false,
    });
    if (r.status !== 0) {
        console.error('[build-upm] DLL build failed');
        process.exit(r.status || 1);
    }

    // 2. Strip -dev from UPM version
    const upmPkgPath = path.join(UPM_DIR, 'package.json');
    const upmPkg = JSON.parse(fs.readFileSync(upmPkgPath, 'utf8'));
    const oldVer = upmPkg.version;
    const cleanVer = oldVer.replace(/-dev$/, '');
    if (oldVer !== cleanVer) {
        upmPkg.version = cleanVer;
        fs.writeFileSync(upmPkgPath, JSON.stringify(upmPkg, null, 2) + '\n', 'utf8');
        console.log(`[build-upm] UPM version: ${oldVer} → ${cleanVer}`);
    } else {
        console.log(`[build-upm] UPM version: ${cleanVer} (already clean)`);
    }

    // 3. Tarball
    if (opts.tarball) {
        console.log('[build-upm] Creating tarball...');
        const tr = spawnSync('npm', ['pack'], { cwd: UPM_DIR, stdio: 'inherit', shell: true });
        if (tr.status !== 0) {
            console.error('[build-upm] npm pack failed');
            process.exit(tr.status || 1);
        }
    }

    console.log('[build-upm] Done.');
}

module.exports = { main };

if (require.main === module) {
    main(process.argv.slice(2));
}
