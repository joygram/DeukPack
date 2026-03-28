#!/usr/bin/env node
/**
 * deukpack init | config — pipeline (deukpack.pipeline.json), workspace/Unity bootstrap (always), VSIX install last.
 * Accepts bootstrap flags: --kind, --engine-root, --manifest-out, -y, --no-unity (see deukpack bootstrap --help).
 *
 * DeukUI orchestration flags are documented in docs/internal/DEUKPACK_DEUK_UI_INIT.md (hidden from public init --help until go-live).
 *
 * --non-interactive: TTY not required; default pipeline + discovery; runs npm install sync + bootstrap --non-interactive (workspace always).
 * --workspace-only: skip pipeline file (same as legacy `deukpack bootstrap` entry).
 */

/** After `deuk-ui` is on the public npm registry: set true and add the matching section back to README.md / README.ko.md. */
const PUBLIC_DEUK_UI_INIT_HELP = false;

function showDeukUiInitHelp() {
    if (PUBLIC_DEUK_UI_INIT_HELP) return true;
    const v = process.env.DEUKPACK_DEUK_UI_HELP;
    return v === '1' || String(v).toLowerCase() === 'true';
}

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { ensureDeukpackNpmInstalled } = require('./init-ensure-deukpack-npm.js');
const { runSyncAndUpmManifest } = require('./lib/upm-helpers.js');

function normalizeRelToConfig(configDir, userPath) {
    const raw = String(userPath || '').trim();
    if (!raw) return raw;
    const abs = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(process.cwd(), raw);
    const rel = path.relative(path.resolve(configDir), abs);
    if (rel.startsWith('..') || rel === '') {
        return raw.replace(/\\/g, '/');
    }
    return rel.replace(/\\/g, '/');
}

async function prompt(rl, text, defaultValue) {
    const d = defaultValue != null && String(defaultValue) !== '' ? String(defaultValue) : undefined;
    const hint = d !== undefined ? ` [${d}]` : '';
    return new Promise((resolve) => {
        rl.question(`${text}${hint}: `, (ans) => {
            const t = ans.trim();
            resolve(t === '' ? (d !== undefined ? d : '') : t);
        });
    });
}

async function promptYes(rl, text, defaultYes) {
    const def = defaultYes ? 'y' : 'n';
    const yn = defaultYes ? '(Y/n)' : '(y/N)';
    const a = (await prompt(rl, `${text} ${yn}`, def)).toLowerCase();
    return a === 'y' || a === 'yes';
}

/** @returns {{ pipelineOut: string, force: boolean, nonInteractive: boolean, workspaceOnly: boolean, skipVsix: boolean, help: boolean, bootstrapForward: string[], useUnityEf: boolean, deukUiKind: string|null, deukUiForward: string[] }} */
function parseInitArgs(argv) {
    const cwd = process.cwd();
    let pipelineOut = path.join(cwd, 'deukpack.pipeline.json');
    let force = false;
    let nonInteractive = false;
    let workspaceOnly = false;
    let skipVsix = false;
    let help = false;
    let useUnityEf = false;
    /** @type {string|null} */
    let deukUiKind = null;
    const bootstrapForward = [];
    const deukUiForward = [];

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') help = true;
        else if (a === '--non-interactive') nonInteractive = true;
        else if (a === '--workspace-only') workspaceOnly = true;
        else if (a === '--skip-vsix') skipVsix = true;
        else if (a === '--use-unity-ef') useUnityEf = true;
        else if (a === '-f' || a === '--force') force = true;
        else if ((a === '-o' || a === '--output') && argv[i + 1]) pipelineOut = path.resolve(cwd, argv[++i]);
        else if (a === '--manifest-out' && argv[i + 1]) {
            bootstrapForward.push(a, argv[++i]);
        } else if (a === '--kind' && argv[i + 1]) {
            bootstrapForward.push(a, argv[++i]);
        } else if ((a === '--engine-root' || a === '--deukpack-root' || a === '--src') && argv[i + 1]) {
            if (a === '--src') console.warn('[WARN] --src is deprecated; use --engine-root <path>.');
            bootstrapForward.push('--engine-root', argv[++i]);
        } else if (a === '-y' || a === '--yes') bootstrapForward.push(a);
        else if (a === '--no-unity') bootstrapForward.push(a);
        else if (a === '--deuk-ui-kind' && argv[i + 1]) {
            const v = String(argv[++i]).toLowerCase();
            if (v !== 'registry' && v !== 'src') {
                console.error(`[deukpack] --deuk-ui-kind must be registry or src (got "${v}")`);
                process.exit(1);
            }
            deukUiKind = v;
        } else if (a === '--app-dir' && argv[i + 1]) {
            deukUiForward.push(a, argv[++i]);
        } else if (a === '--styles-dir' && argv[i + 1]) {
            deukUiForward.push(a, argv[++i]);
        } else {
            console.error(`Unknown init option: ${a}`);
            process.exit(1);
        }
    }

    if (deukUiForward.length > 0 && deukUiKind == null) {
        console.warn(
            '[deukpack] --app-dir / --styles-dir apply only with --deuk-ui-kind; ignoring those flags.'
        );
        deukUiForward.length = 0;
    }

    return {
        pipelineOut,
        force,
        nonInteractive,
        workspaceOnly,
        skipVsix,
        help,
        bootstrapForward,
        useUnityEf,
        deukUiKind,
        deukUiForward,
    };
}

function printInitHelp() {
    console.log(`Usage: deukpack init | config [options]

Creates or edits deukpack.pipeline.json, then bootstrap (writes .deukpack/workspace.json), then optional VSIX (last).

Init / pipeline:
  -o, --output <file>     Pipeline JSON path (default: ./deukpack.pipeline.json)
  -f, --force             Overwrite / re-prompt without merging ambiguous state
  --non-interactive       No TTY; default pipeline + npm sync + bootstrap --non-interactive
  --workspace-only        Only workspace.json / Unity flow (same as deukpack bootstrap)
  --skip-vsix             Skip bundled Deuk IDL VSIX install (default: always attempt; forwarded to bootstrap)

Bootstrap (forwarded):
  --kind package|src      Engine install kind (aliases registry|npm → package for engine)
  --engine-root <path>     DeukPack repo root (--kind src)
  --manifest-out <dir>     Where to write .deukpack/ (default: cwd)
  -y, --yes                Non-interactive submodule yes
  --no-unity               Skip Unity scan
${showDeukUiInitHelp()
        ? `
DeukUI (deuk-ui-init orchestration; not engine --kind):
  --deuk-ui-kind registry|src   Run bundled deuk-ui-init (default workflow vs src + override hint)
  --app-dir <path>              Forwarded to deuk-ui-init (only with --deuk-ui-kind)
  --styles-dir <path>           Forwarded to deuk-ui-init (only with --deuk-ui-kind)
`
        : '\n'}
Game profile (optional, when scripts/build-deukpack.config.json exists under cwd):
  --use-unity-ef           Sets unity.enableEfPersistence and default adapter paths; writes .deukpack/unity_ef_pipeline.json (recommended scripting define DEUKPACK_UNITY_EF for server asm).

Local npm: if package.json exists, runs npm install and ensures deukpack is installed; fails if npm ls deukpack is invalid.`);
}

/** Merge Unity EF flags into game scripts/build-deukpack.config.json when present; write .deukpack/unity_ef_pipeline.json. */
async function mergeGameBuildDeukpackProfile(cwd) {
    const p = path.join(cwd, 'scripts', 'build-deukpack.config.json');
    if (!fsSync.existsSync(p)) {
        console.warn('[deukpack] --use-unity-ef: scripts/build-deukpack.config.json not found; nothing merged.');
        return;
    }
    let obj;
    try {
        obj = JSON.parse(await fs.readFile(p, 'utf8'));
    } catch (e) {
        console.warn('[deukpack] --use-unity-ef: could not parse build-deukpack.config.json:', e.message);
        return;
    }
    const prevUnity = typeof obj.unity === 'object' && obj.unity ? obj.unity : {};
    obj.unity = { ...prevUnity, enableEfPersistence: true };
    const dbEfDir = path.join(cwd, 'unity_app', 'Assets', 'DeukScripts', 'csServerLogic', 'db_ef');
    if (!obj.persistenceAdapterClientPath && fsSync.existsSync(dbEfDir)) {
        obj.persistenceAdapterClientPath = 'unity_app/Assets/DeukScripts/csServerLogic/db_ef';
    }
    await fs.writeFile(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
    console.log(`[deukpack] Updated ${path.relative(cwd, p) || p} (unity.enableEfPersistence)`);

    const manifestDir = path.join(cwd, '.deukpack');
    await fs.mkdir(manifestDir, { recursive: true });
    const marker = {
        enableEfPersistence: true,
        recommendedDefine: 'DEUKPACK_UNITY_EF',
    };
    await fs.writeFile(
        path.join(manifestDir, 'unity_ef_pipeline.json'),
        `${JSON.stringify(marker, null, 2)}\n`,
        'utf8'
    );
    console.log('[deukpack] Wrote .deukpack/unity_ef_pipeline.json');
}

function hasDeukFileUnder(dirAbs) {
    try {
        const walk = (d) => {
            const names = fsSync.readdirSync(d, { withFileTypes: true });
            for (const e of names) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) {
                    if (e.name === 'node_modules' || e.name === '.git') continue;
                    if (walk(p)) return true;
                } else if (e.name.endsWith('.deuk')) return true;
            }
            return false;
        };
        return walk(dirAbs);
    } catch {
        return false;
    }
}

/* ── Language auto-detection (tiered) ── */

function hasAnyLang(l) { return l.csharp || l.cpp || l.ts || l.js; }

function fileExistsIn(dir, name) {
    return fsSync.existsSync(path.join(dir, name));
}

function anyFileMatchesIn(dir, test) {
    try { return fsSync.readdirSync(dir).some(test); }
    catch { return false; }
}

/**
 * Tiered project language detection.
 * Tier 1: Project / build config files (.csproj, CMakeLists.txt, tsconfig.json …)
 * Tier 2: Source file extensions (.cs, .cpp, .ts, .js)
 * Tier 3: template.json (DeukPackKits convention)
 * Tier 4: Folder name heuristic
 * @returns {{ csharp:boolean, cpp:boolean, ts:boolean, js:boolean, outputDir:string|null, source:string }|null}
 */
function detectProjectLanguages(configDir) {
    const langs = { csharp: false, cpp: false, ts: false, js: false };
    let outputDir = null;
    let source = '';

    /* ── Tier 1: project / build files ── */

    // C#
    if (anyFileMatchesIn(configDir, n => n.endsWith('.csproj') || n.endsWith('.sln'))
        || fileExistsIn(configDir, 'global.json')) {
        langs.csharp = true;
    }
    // C++
    if (fileExistsIn(configDir, 'CMakeLists.txt')
        || anyFileMatchesIn(configDir, n => n.endsWith('.vcxproj'))
        || fileExistsIn(configDir, 'Makefile') || fileExistsIn(configDir, 'GNUmakefile')
        || fileExistsIn(configDir, 'build.ninja')
        || fileExistsIn(configDir, 'meson.build')
        || fileExistsIn(configDir, 'premake5.lua')
        || fileExistsIn(configDir, 'vcpkg.json')
        || fileExistsIn(configDir, 'xmake.lua')) {
        langs.cpp = true;
    }
    // TypeScript
    if (fileExistsIn(configDir, 'tsconfig.json')
        || anyFileMatchesIn(configDir, n => /^tsconfig\..*\.json$/.test(n))) {
        langs.ts = true;
    }
    // Unity → C#
    if (fileExistsIn(path.join(configDir, 'Packages'), 'manifest.json')
        || (fsSync.existsSync(path.join(configDir, 'Assets'))
            && fsSync.existsSync(path.join(configDir, 'ProjectSettings')))) {
        langs.csharp = true;
    }
    // package.json: check for typescript dep → TS; otherwise Node/JS
    if (!langs.ts && fileExistsIn(configDir, 'package.json')) {
        try {
            const pkg = JSON.parse(fsSync.readFileSync(path.join(configDir, 'package.json'), 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (allDeps.typescript) langs.ts = true;
        } catch { /* ignore */ }
    }

    if (hasAnyLang(langs)) source = 'project files';

    /* ── Tier 2: source file extensions (shallow) ── */
    if (!hasAnyLang(langs)) {
        try {
            const entries = fsSync.readdirSync(configDir);
            if (entries.some(e => e.endsWith('.cs'))) langs.csharp = true;
            if (entries.some(e => /\.(cpp|cc|cxx|hpp)$/.test(e))) langs.cpp = true;
            if (entries.some(e => /\.(ts|tsx)$/.test(e))) langs.ts = true;
            if (!langs.ts && entries.some(e => /\.(js|mjs|jsx)$/.test(e))) langs.js = true;
        } catch { /* ignore */ }
        if (hasAnyLang(langs)) source = 'source files';
    }

    /* ── Tier 3: template.json (DeukPackKits) ── */
    const tmplPath = path.join(configDir, 'template.json');
    if (fsSync.existsSync(tmplPath)) {
        try {
            const tmpl = JSON.parse(fsSync.readFileSync(tmplPath, 'utf8'));
            const codegen = (tmpl.scripts && tmpl.scripts.codegen) || '';

            if (!hasAnyLang(langs)) {
                const stack = Array.isArray(tmpl.stack) ? tmpl.stack : [];
                for (const s of stack) {
                    const l = s.toLowerCase();
                    if (l === 'csharp' || l === 'unity') langs.csharp = true;
                    else if (l === 'cpp') langs.cpp = true;
                    else if (l === 'typescript') {
                        if (codegen.includes('--ts')) langs.ts = true;
                        else langs.js = true;
                    }
                    else if (l === 'nodejs' || l === 'javascript') langs.js = true;
                }
                if (hasAnyLang(langs)) source = 'template.json';
            }

            // Extract outputDir from codegen command regardless of tier
            if (codegen) {
                const m = codegen.match(/deukpack\s+\S+\.deuk\s+(\S+)/);
                if (m && !m[1].startsWith('-')) outputDir = m[1];
            }
        } catch { /* ignore */ }
    }

    /* ── Tier 4: folder name heuristic ── */
    if (!hasAnyLang(langs)) {
        const folder = path.basename(configDir).toLowerCase();
        if (folder === 'csharp' || folder === 'cs') langs.csharp = true;
        else if (folder === 'cpp' || folder === 'c++') langs.cpp = true;
        else if (folder === 'ts' || folder === 'typescript') langs.js = true;
        else if (folder === 'js' || folder === 'javascript') langs.js = true;
        if (hasAnyLang(langs)) source = 'folder name';
    }

    if (!hasAnyLang(langs)) return null;
    return { ...langs, outputDir, source };
}

function formatDetectedLangs(detected) {
    const names = [];
    if (detected.csharp) names.push('C#');
    if (detected.cpp) names.push('C++');
    if (detected.ts) names.push('TypeScript');
    if (detected.js) names.push('JavaScript');
    return names.join(', ');
}

function buildDefaultPipelineConfig(configDir) {
    const defineRoot = 'idls';
    const base = path.join(configDir, defineRoot);
    if (!fsSync.existsSync(base) || !hasDeukFileUnder(base)) {
        return null;
    }
    const detected = detectProjectLanguages(configDir);
    const langs = detected || { csharp: true, cpp: false, ts: false, js: false };
    const outputDirVal = (detected && detected.outputDir) || defineRoot;
    if (detected) {
        console.log(`[deukpack] Detected languages (${detected.source}): ${formatDetectedLangs(detected)}`);
    }
    const includePaths = [{ path: defineRoot, recursive: true }];
    return {
        jobs: [
            {
                name: 'main',
                defineScope: 'all',
                exclude: [],
                outputDir: outputDirVal,
                csharp: !!langs.csharp,
                cpp: !!langs.cpp,
                ts: !!langs.ts,
                js: !!langs.js,
            },
        ],
        defineRoot,
        exclude: [],
        includePaths,
    };
}

async function writePipelineFromInteractive(rl, outPath, configDir, existing, force) {
    if (existing && !force) {
        if (Array.isArray(existing.jobs) && existing.jobs.length > 1) {
            console.warn(
                'Warning: this file has multiple jobs; saving will keep only one job (the one you configure now).\n'
            );
        }
        const edit = await promptYes(rl, 'Reconfigure', true);
        if (!edit) {
            console.log('Left unchanged. Run npx deukpack init when you want to reconfigure.');
            return false;
        }
    }

    const job0 = existing && Array.isArray(existing.jobs) && existing.jobs[0] ? existing.jobs[0] : {};

    const defineRootIn = await prompt(
        rl,
        'defineRoot (IDL directory, e.g. idls)',
        existing && existing.defineRoot != null ? String(existing.defineRoot) : 'idls'
    );

    const dr = String(defineRootIn || '').trim() || 'idls';
    const includeRel = normalizeRelToConfig(configDir, dr) || dr.replace(/\\/g, '/');
    const includePaths = includeRel ? [{ path: includeRel, recursive: true }] : [];

    const detected = detectProjectLanguages(configDir);
    let csharp, cpp, ts, js;
    if (detected && hasAnyLang(detected)) {
        console.log(`\nDetected languages (${detected.source}): ${formatDetectedLangs(detected)}`);
        console.log('Edit deukpack.pipeline.json after init to change generators.\n');
        csharp = detected.csharp;
        cpp = detected.cpp;
        ts = detected.ts;
        js = detected.js;
    } else {
        console.log('\nGenerators (enable at least one):');
        csharp = await promptYes(rl, 'Generate C#', job0.csharp !== false);
        cpp = await promptYes(rl, 'C++', !!job0.cpp);
        ts = await promptYes(rl, 'TypeScript', !!job0.ts);
        js = await promptYes(rl, 'JavaScript', !!job0.js);
    }

    if (!csharp && !cpp && !ts && !js) {
        console.error('Enable at least one language.');
        process.exit(1);
    }

    const outputDir = (detected && detected.outputDir) || dr;

    const job = {
        name: job0.name || 'main',
        defineScope: 'all',
        exclude: [],
        outputDir: normalizeRelToConfig(configDir, outputDir) || outputDir.replace(/\\/g, '/'),
        csharp,
        cpp,
        ts,
        js,
    };
    if (job0.json) job.json = true;

    const config = { jobs: [job] };
    if (dr) config.defineRoot = dr;
    if (includePaths.length) config.includePaths = includePaths;

    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    console.log(`\nWrote ${outPath}`);
    console.log(
        'For exclude, include paths, and other pipeline options, edit this JSON (see the one-line summary at the end of init).'
    );
    return true;
}

async function runBootstrapSection(cwd, opts) {
    const { main: bootstrapMain } = require('./bootstrap.js');
    const args = [...opts.bootstrapForward];
    if (opts.nonInteractive && !args.includes('--non-interactive')) args.push('--non-interactive');
    if (opts.skipVsix && !args.includes('--skip-vsix')) args.push('--skip-vsix');
    await bootstrapMain(args);
}

/**
 * Spawn deuk-ui-init (dependency deuk-ui). INIT_CWD=cwd for postinstall-compatible resolution.
 * @param {string} cwd
 * @param {'registry'|'src'} kind
 * @param {string[]} forwardArgv  Pairs e.g. ['--app-dir','src/next-app']
 */
function runDeukUiInit(cwd, kind, forwardArgv) {
    let pkgPath;
    try {
        pkgPath = require.resolve('deuk-ui/package.json', { paths: [cwd, path.join(__dirname, '..')] });
    } catch {
        console.error(
            '[deukpack] Missing npm package "deuk-ui". Run npm install (deukpack lists deuk-ui as a dependency).'
        );
        process.exit(1);
    }
    const initJs = path.join(path.dirname(pkgPath), 'bin', 'init.js');
    if (!fsSync.existsSync(initJs)) {
        console.error('[deukpack] deuk-ui bin/init.js not found:', initJs);
        process.exit(1);
    }
    const argv = [initJs, '--kind', kind, ...forwardArgv];
    const env = { ...process.env, INIT_CWD: cwd };
    const r = spawnSync(process.execPath, argv, { cwd, stdio: 'inherit', env });
    if (r.error) {
        console.error('[deukpack] deuk-ui-init:', r.error.message);
        process.exit(1);
    }
    if (r.status !== 0 && r.status != null) process.exit(r.status);
    if (r.signal) process.exit(1);
}

async function maybeRunDeukUiInit(cwd, opts) {
    if (!opts.deukUiKind) return;
    console.log(`[deukpack] deuk-ui-init --kind ${opts.deukUiKind}`);
    runDeukUiInit(cwd, opts.deukUiKind, opts.deukUiForward);
}

async function main(argv) {
    const opts = parseInitArgs(argv);
    if (opts.help) {
        printInitHelp();
        return;
    }

    const cwd = process.cwd();
    const nonInteractive = opts.nonInteractive;
    const tty = process.stdin.isTTY && process.stdout.isTTY;

    if (!nonInteractive && !tty) {
        console.error('deukpack init requires a TTY, or pass --non-interactive.');
        process.exit(1);
    }

    ensureDeukpackNpmInstalled(cwd, { nonInteractive });

    const vsixUnityHint = () => {
        const { hasUnityProjectNear } = require('./bundled-deuk-idl-vsix.js');
        return hasUnityProjectNear(cwd);
    };

    if (opts.workspaceOnly) {
        const defaultPipeline = path.join(cwd, 'deukpack.pipeline.json');
        await runBootstrapSection(cwd, { ...opts, skipVsix: true });
        await runSyncAndUpmManifest(cwd);
        if (!opts.skipVsix) {
            const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
            await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
        }
        printInitFollowUpOneLiner(cwd, defaultPipeline);
        if (opts.useUnityEf) await mergeGameBuildDeukpackProfile(cwd);
        await maybeRunDeukUiInit(cwd, opts);
        return;
    }

    const outPath = opts.pipelineOut;
    const configDir = path.dirname(path.resolve(outPath));

    let existing = null;
    if (!opts.force && fsSync.existsSync(outPath)) {
        try {
            existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
        } catch (e) {
            console.warn('Could not parse existing file; starting fresh.', e.message);
        }
    }

    let wrotePipeline = false;

    if (nonInteractive) {
        if (existing && !opts.force) {
            console.log(`[deukpack] Using existing pipeline file: ${outPath}`);
        } else {
            const def = buildDefaultPipelineConfig(configDir);
            if (!def) {
                console.error(
                    '[deukpack] --non-interactive: no default .deuk entry under idls; add IDL or run interactive init.'
                );
                process.exit(1);
            }
            await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
            await fs.writeFile(outPath, `${JSON.stringify(def, null, 2)}\n`, 'utf8');
            console.log(`[deukpack] Wrote default pipeline: ${outPath}`);
            wrotePipeline = true;
        }
    } else {
        let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try {
            console.log(
                'DeukPack init — pipeline JSON, workspace bootstrap (.deukpack/workspace.json), then bundled Deuk IDL VSIX (unless --skip-vsix).'
            );
            console.log(`Config path: ${outPath}`);
            if (!fsSync.existsSync(outPath)) {
                console.log('Paths you enter are stored relative to the config file’s folder when possible.');
                console.log(
                    'Re-run `npx deukpack init` anytime to change the pipeline; then `npx deukpack run` to regenerate.\n'
                );
            } else {
                console.log('');
            }

            const ok = await writePipelineFromInteractive(rl, outPath, configDir, existing, opts.force);
            if (!ok) {
                return;
            }
            wrotePipeline = true;

            rl.close();
            rl = null;
            await runBootstrapSection(cwd, { ...opts, skipVsix: true });
            await runSyncAndUpmManifest(cwd);
        } finally {
            if (rl) rl.close();
        }
        if (!opts.skipVsix) {
            const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
            await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
        }
        printInitFollowUpOneLiner(cwd, outPath);
        await maybeRunDeukUiInit(cwd, opts);
        return;
    }

    /* non-interactive: workspace bootstrap, then sync, then VSIX install */
    await runBootstrapSection(cwd, { ...opts, skipVsix: true });
    await runSyncAndUpmManifest(cwd);

    if (!opts.skipVsix) {
        const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
        await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
    }

    if (wrotePipeline || fsSync.existsSync(outPath)) {
        printInitFollowUpOneLiner(cwd, outPath);
    }
    if (opts.useUnityEf) await mergeGameBuildDeukpackProfile(cwd);
    await maybeRunDeukUiInit(cwd, opts);
}

/** Single closing line after bootstrap + VSIX (init / --workspace-only). */
function printInitFollowUpOneLiner(cwd, pipelineOutPath) {
    const abs = path.resolve(pipelineOutPath);
    const rel = path.relative(path.resolve(cwd), abs);
    const pipeDisp = rel && !rel.startsWith('..') ? rel.replace(/\\/g, '/') : abs.replace(/\\/g, '/');
    console.log(
        `[deukpack] When updating, run npx deukpack init; edit ${pipeDisp} or .deukpack/workspace.json for details; then npx deukpack run.`
    );
}

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { main, parseInitArgs, printInitHelp };
