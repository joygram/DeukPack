#!/usr/bin/env node
/**
 * DeukPack 내부: Unity UPM `app.deukpack.runtime/Runtime/Plugins` 용
 * DeukPack.Core / DeukPack.Protocol / DeukPack.ExcelProtocol (netstandard2.0) 빌드 후 대상 디렉터리로 복사.
 *
 * Usage:
 *   node scripts/build_unity_runtime_plugins.js --out <절대 또는 cwd 기준 상대 경로> [-c Debug|Release]
 *
 * 환경변수: DEUKPACK_UNITY_PLUGINS_OUT — --out 이 없을 때 출력 디렉터리(내부 CI·래퍼용).
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
    const argv = process.argv.slice(2);
    let outDir = process.env.DEUKPACK_UNITY_PLUGINS_OUT
        ? String(process.env.DEUKPACK_UNITY_PLUGINS_OUT).trim()
        : null;
    let configuration = 'Debug';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            console.log(`Usage: node scripts/build_unity_runtime_plugins.js --out <dir> [-c Debug|Release]`);
            process.exit(0);
        }
        if (a === '--out' && argv[i + 1]) {
            outDir = argv[++i];
            continue;
        }
        if ((a === '-c' || a === '--configuration') && argv[i + 1]) {
            configuration = argv[++i];
            continue;
        }
    }
    return {
        outDir: outDir ? path.resolve(process.cwd(), outDir.replace(/\\/g, '/')) : null,
        configuration
    };
}

function runDotnet(cwd, args) {
    const r = spawnSync('dotnet', args, { cwd, stdio: 'inherit', shell: true });
    if (r.error) throw r.error;
    if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function copyArtifacts(srcDir, files, destDir) {
    ensureDir(destDir);
    let ok = true;
    for (const name of files) {
        const src = path.join(srcDir, name);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(destDir, name);
        try {
            fs.copyFileSync(src, dest);
        } catch (err) {
            const locked = err && (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EBUSY');
            if (locked) {
                console.warn(
                    `[WARN] Copy failed (file in use?). Close Unity Editor and retry, or copy manually from:\n       ${srcDir}`
                );
            } else {
                console.warn(`[WARN] Copy ${name}: ${err.message}`);
            }
            ok = false;
        }
    }
    return ok;
}

function main() {
    const { outDir, configuration } = parseArgs();
    if (!outDir) {
        console.error('[ERROR] build_unity_runtime_plugins.js: missing --out <dir> (or DEUKPACK_UNITY_PLUGINS_OUT)');
        process.exit(1);
    }

    // --- DeukPack.Core ---
    const coreProjDir = path.join(ROOT, 'DeukPack.Core');
    const coreProj = path.join(coreProjDir, 'DeukPack.Core.csproj');
    if (!fs.existsSync(coreProj)) {
        console.error('[ERROR] DeukPack.Core.csproj not found:', coreProj);
        process.exit(1);
    }

    console.log('[DeukPack] Building DeukPack.Core (netstandard2.0)...');
    runDotnet(coreProjDir, [
        'build',
        'DeukPack.Core.csproj',
        '-f',
        'netstandard2.0',
        '-c',
        configuration
    ]);

    const coreOut = path.join(coreProjDir, 'bin', configuration, 'netstandard2.0');
    const coreDll = path.join(coreOut, 'DeukPack.Core.dll');
    if (!fs.existsSync(coreDll)) {
        console.error('[ERROR] DeukPack.Core.dll not found after build:', coreDll);
        process.exit(1);
    }

    const okCore = copyArtifacts(
        coreOut,
        ['DeukPack.Core.dll', 'DeukPack.Core.pdb'],
        outDir
    );
    if (okCore) {
        console.log('[OK] DeukPack.Core →', outDir);
    }

    // --- DeukPack.Protocol ---
    const protocolProjDir = path.join(ROOT, 'DeukPack.Protocol');
    const protocolProj = path.join(protocolProjDir, 'DeukPack.Protocol.csproj');
    if (!fs.existsSync(protocolProj)) {
        console.error('[ERROR] DeukPack.Protocol.csproj not found:', protocolProj);
        process.exit(1);
    }

    console.log('[DeukPack] Building DeukPack.Protocol (netstandard2.0)...');
    runDotnet(protocolProjDir, [
        'build',
        'DeukPack.Protocol.csproj',
        '-f',
        'netstandard2.0',
        '-c',
        configuration
    ]);

    const protocolOut = path.join(protocolProjDir, 'bin', configuration, 'netstandard2.0');
    const protocolDll = path.join(protocolOut, 'DeukPack.Protocol.dll');
    if (!fs.existsSync(protocolDll)) {
        console.error('[ERROR] DeukPack.Protocol.dll not found after build:', protocolDll);
        process.exit(1);
    }

    const okProto = copyArtifacts(
        protocolOut,
        ['DeukPack.Protocol.dll', 'DeukPack.Protocol.pdb'],
        outDir
    );
    if (okProto) {
        console.log('[OK] DeukPack.Protocol →', outDir);
    }

    const excelProjDir = path.join(ROOT, 'DeukPack.ExcelProtocol');
    const excelProj = path.join(excelProjDir, 'DeukPack.ExcelProtocol.csproj');
    if (!fs.existsSync(excelProj)) {
        console.warn('[WARN] DeukPack.ExcelProtocol.csproj not found, skipping Excel DLL');
        process.exit(0);
    }

    console.log('[DeukPack] Building DeukPack.ExcelProtocol (netstandard2.0)...');
    runDotnet(excelProjDir, [
        'build',
        'DeukPack.ExcelProtocol.csproj',
        '-f',
        'netstandard2.0',
        '-c',
        configuration
    ]);

    const excelOut = path.join(excelProjDir, 'bin', configuration, 'netstandard2.0');
    const excelDllPath = path.join(excelOut, 'DeukPack.ExcelProtocol.dll');
    if (!fs.existsSync(excelDllPath)) {
        console.error('[ERROR] DeukPack.ExcelProtocol.dll not found after build:', excelDllPath);
        process.exit(1);
    }

    const okExcel = copyArtifacts(
        excelOut,
        ['DeukPack.ExcelProtocol.dll', 'DeukPack.ExcelProtocol.pdb'],
        outDir
    );
    if (okExcel) {
        console.log('[OK] DeukPack.ExcelProtocol →', outDir);
    }

    if (!okCore || !okProto || !okExcel) {
        console.log('[INFO] Some plugin copies failed; Unity may be locking DLLs. See warnings above.');
    }
    process.exit(0);
}

main();
