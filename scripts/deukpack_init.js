#!/usr/bin/env node
/**
 * deukpack init | config — pipeline (deukpack.pipeline.json), workspace/Unity bootstrap (always), VSIX install last.
 * Accepts bootstrap flags: --kind, --engine-root, --manifest-out, -y, --no-unity (see deukpack bootstrap --help).
 *
 * --non-interactive: TTY not required; default pipeline + discovery; runs npm install sync + bootstrap --non-interactive (workspace always).
 * --workspace-only: skip pipeline file (same as legacy `deukpack bootstrap` entry).
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { ensureDeukpackNpmInstalled } = require('./init-ensure-deukpack-npm.js');

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

/** @returns {{ pipelineOut: string, force: boolean, nonInteractive: boolean, workspaceOnly: boolean, skipVsix: boolean, help: boolean, bootstrapForward: string[] }} */
function parseInitArgs(argv) {
    const cwd = process.cwd();
    let pipelineOut = path.join(cwd, 'deukpack.pipeline.json');
    let force = false;
    let nonInteractive = false;
    let workspaceOnly = false;
    let skipVsix = false;
    let help = false;
    const bootstrapForward = [];

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') help = true;
        else if (a === '--non-interactive') nonInteractive = true;
        else if (a === '--workspace-only') workspaceOnly = true;
        else if (a === '--skip-vsix') skipVsix = true;
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
        else {
            console.error(`Unknown init option: ${a}`);
            process.exit(1);
        }
    }

    return {
        pipelineOut,
        force,
        nonInteractive,
        workspaceOnly,
        skipVsix,
        help,
        bootstrapForward,
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
  --kind package|src      Engine install kind
  --engine-root <path>     DeukPack repo root (--kind src)
  --manifest-out <dir>     Where to write .deukpack/ (default: cwd)
  -y, --yes                Non-interactive submodule yes
  --no-unity               Skip Unity scan

Local npm: if package.json exists, runs npm install and ensures deukpack is installed; fails if npm ls deukpack is invalid.`);
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

function buildDefaultPipelineConfig(configDir) {
    const defineRoot = '_deuk_define';
    const base = path.join(configDir, defineRoot);
    if (!fsSync.existsSync(base) || !hasDeukFileUnder(base)) {
        return null;
    }
    const includePaths = [{ path: defineRoot, recursive: true }];
    return {
        jobs: [
            {
                name: 'main',
                defineScope: 'all',
                exclude: [],
                outputDir: defineRoot,
                csharp: true,
                cpp: false,
                ts: false,
                js: false,
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
        'defineRoot (IDL directory, e.g. _deuk_define)',
        existing && existing.defineRoot != null ? String(existing.defineRoot) : '_deuk_define'
    );

    const dr = String(defineRootIn || '').trim() || '_deuk_define';
    const outputDir = dr;
    const includeRel = normalizeRelToConfig(configDir, dr) || dr.replace(/\\/g, '/');
    const includePaths = includeRel ? [{ path: includeRel, recursive: true }] : [];

    console.log('\nGenerators (enable at least one):');
    const csharp = await promptYes(rl, 'Generate C#', job0.csharp !== false);
    const cpp = await promptYes(rl, 'C++', !!job0.cpp);
    const ts = await promptYes(rl, 'TypeScript', !!job0.ts);
    const js = await promptYes(rl, 'JavaScript', !!job0.js);

    if (!csharp && !cpp && !ts && !js) {
        console.error('Enable at least one language.');
        process.exit(1);
    }

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
        if (!opts.skipVsix) {
            const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
            await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
        }
        printInitFollowUpOneLiner(cwd, defaultPipeline);
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
                    '[deukpack] --non-interactive: no default .deuk entry under _deuk_define; add IDL or run interactive init.'
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
        } finally {
            if (rl) rl.close();
        }
        if (!opts.skipVsix) {
            const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
            await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
        }
        printInitFollowUpOneLiner(cwd, outPath);
        return;
    }

    /* non-interactive: workspace bootstrap, then VSIX install */
    await runBootstrapSection(cwd, { ...opts, skipVsix: true });

    if (!opts.skipVsix) {
        const { applyBundledVsixInstall } = require('./bundled-deuk-idl-vsix.js');
        await applyBundledVsixInstall(cwd, { hasUnityProject: vsixUnityHint() });
    }

    if (wrotePipeline || fsSync.existsSync(outPath)) {
        printInitFollowUpOneLiner(cwd, outPath);
    }
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
