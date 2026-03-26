#!/usr/bin/env node
/**
 * IDL 상호전환: Thrift IDL → DeukPack (.deuk)
 *
 * 기존 Thrift IDL 트리를 보존하고, 변환 출력만 지정 디렉토리로 내보냄.
 * 실행 후 빌드는 출력 경로(idls 등)를 사용.
 *
 * 사용법:
 *   node thrift-to-deuk.js \
 *     --source-root <thrift_root_dir> \
 *     --entry <entry.thrift> \
 *     --out-dir <output_deuk_dir> \
 *     [--include <dir1> --include <dir2> ...] \
 *     [--emit-per-file] \
 *     [--entry-per-file <extra_entry.thrift> --out-per-file <extra_out_dir>]
 *
 * 옵션:
 *   --source-root  Thrift IDL 루트 디렉토리 (--define-root 로 전달)
 *   --entry        변환할 진입 .thrift 파일 경로
 *   --out-dir      DeukPack .deuk 출력 디렉토리
 *   --include      추가 include 경로 (여러 번 지정 가능)
 *   --emit-per-file  --emit-per-file 플래그를 DeukPack에 전달
 *   --entry-per-file  두 번째 진입 파일 (emit-per-file 모드로 별도 변환)
 *   --out-per-file   두 번째 진입 파일의 출력 디렉토리
 *   --deukpack-dir   DeukPack 레포 경로 (기본: 이 스크립트 기준 '../..')
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

function parseArgs(argv) {
    const args = argv.slice(2);
    const opts = {
        sourceRoot: null,
        entry: null,
        outDir: null,
        includes: [],
        emitPerFile: false,
        entryPerFile: null,
        outPerFile: null,
        deukpackDir: path.resolve(__dirname, '../..'),
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--source-root':   opts.sourceRoot = args[++i]; break;
            case '--entry':         opts.entry = args[++i]; break;
            case '--out-dir':       opts.outDir = args[++i]; break;
            case '--include':       opts.includes.push(args[++i]); break;
            case '--emit-per-file': opts.emitPerFile = true; break;
            case '--entry-per-file': opts.entryPerFile = args[++i]; break;
            case '--out-per-file':  opts.outPerFile = args[++i]; break;
            case '--deukpack-dir':  opts.deukpackDir = args[++i]; break;
        }
    }
    return opts;
}

function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: 'inherit', cwd, shell: false });
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
        p.on('error', reject);
    });
}

async function buildConvertArgs(entry, sourceRoot, outDir, buildDir, includes, extraFlags = []) {
    const includePaths = [];
    for (const dir of includes) {
        try {
            await fs.access(dir);
            includePaths.push('-I', dir);
        } catch {
            console.warn('   [SKIP] include 없음:', dir);
        }
    }
    return [
        entry,
        buildDir,
        '--define-root', sourceRoot,
        '--convert-to-deuk', outDir,
        ...extraFlags,
        ...includePaths,
    ];
}

async function main() {
    const opts = parseArgs(process.argv);

    if (!opts.entry || !opts.outDir || !opts.sourceRoot) {
        console.error('필수 인자 누락: --source-root, --entry, --out-dir');
        console.error('사용법: node thrift-to-deuk.js --source-root <dir> --entry <file> --out-dir <dir>');
        process.exit(1);
    }

    const buildScript = path.join(opts.deukpackDir, 'scripts', 'build_deukpack.js');
    try {
        await fs.access(buildScript);
    } catch {
        console.error('DeukPack build_deukpack.js 없음:', buildScript);
        console.error('--deukpack-dir 옵션으로 DeukPack 레포 경로를 지정하세요.');
        process.exit(1);
    }

    try {
        await fs.access(opts.entry);
    } catch {
        console.error('진입 파일 없음:', opts.entry);
        process.exit(1);
    }

    const buildDir = path.join(opts.outDir, '.thrift-build');
    await fs.mkdir(opts.outDir, { recursive: true });

    console.log('[thrift-to-deuk] 변환 시작:', opts.entry, '→', opts.outDir);

    const mainArgs = await buildConvertArgs(
        opts.entry,
        opts.sourceRoot,
        opts.outDir,
        buildDir,
        opts.includes,
    );
    await runCommand('node', [buildScript, ...mainArgs], opts.deukpackDir);
    console.log('[thrift-to-deuk] 완료:', opts.outDir);

    if (opts.entryPerFile && opts.outPerFile) {
        await fs.mkdir(opts.outPerFile, { recursive: true });
        console.log('[thrift-to-deuk] emit-per-file 변환:', opts.entryPerFile, '→', opts.outPerFile);
        const perFileArgs = await buildConvertArgs(
            opts.entryPerFile,
            opts.sourceRoot,
            opts.outPerFile,
            buildDir,
            opts.includes,
            ['--emit-per-file'],
        );
        await runCommand('node', [buildScript, ...perFileArgs], opts.deukpackDir);
        console.log('[thrift-to-deuk] emit-per-file 완료:', opts.outPerFile);
    }

    console.log('\n변환 완료. 이후 빌드는 출력 경로를 사용하세요.');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
