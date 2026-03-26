#!/usr/bin/env node
/**
 * Bootstrap: discover game/Unity layout, write `.deukpack/workspace.json`.
 * CLI entry `npx deukpack bootstrap` is implemented as `deukpack init --workspace-only` (see bin/deukpack.js).
 *
 *   node scripts/bootstrap.js
 *   node scripts/bootstrap.js --non-interactive --kind package
 *
 * `deukpack init` always calls this module after the pipeline / VSIX steps.
 * npm `postinstall` only hints when pipeline + workspace are missing (see npm-postinstall.js).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const MANIFEST_DIR = '.deukpack';
const MANIFEST_NAME = 'workspace.json';

function parseArgs(argv) {
    let manifestOut = null;
    let engineRoot = null;
    let yes = false;
    let skipUnity = false;
    let help = false;
    let kind = null;
    let nonInteractive = false;
    let skipVsix = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') help = true;
        else if (a === '-y' || a === '--yes') yes = true;
        else if (a === '--non-interactive') nonInteractive = true;
        else if (a === '--skip-vsix') skipVsix = true;
        else if (a === '--no-unity') skipUnity = true;
        else if (
            (a === '--engine-root' || a === '--deukpack-root' || a === '--src') &&
            argv[i + 1]
        ) {
            if (a === '--src') {
                console.warn('[WARN] --src is deprecated; use --engine-root <path>.');
            }
            engineRoot = argv[++i];
        } else if ((a === '--manifest-out' || a === '-o') && argv[i + 1]) manifestOut = argv[++i];
        else if (a === '--kind' && argv[i + 1]) kind = String(argv[++i]).toLowerCase();
    }
    return { manifestOut, engineRoot, yes, skipUnity, help, kind, nonInteractive, skipVsix };
}

function validateEngineRoot(deukPackRoot) {
    const csproj = path.join(deukPackRoot, 'DeukPack.Protocol', 'DeukPack.Protocol.csproj');
    return fs.existsSync(csproj);
}

function tryAddEngineCandidate(set, dir) {
    try {
        const n = path.normalize(path.resolve(dir));
        if (validateEngineRoot(n)) set.add(n);
    } catch {
        /* ignore */
    }
}

/** All distinct valid DeukPack engine roots near startDir (walk-up, siblings, git root). */
function discoverDeukPackCandidates(startDir) {
    const set = new Set();
    const start = path.resolve(startDir);
    let d = start;
    const root = path.parse(d).root;
    while (d && d !== root) {
        tryAddEngineCandidate(set, d);
        d = path.dirname(d);
    }
    const parent = path.dirname(start);
    tryAddEngineCandidate(set, path.join(parent, 'DeukPack'));
    const gp = path.dirname(parent);
    tryAddEngineCandidate(set, path.join(gp, 'DeukPack'));
    try {
        const entries = fs.readdirSync(parent, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isDirectory() || e.name !== 'DeukPack') continue;
            tryAddEngineCandidate(set, path.join(parent, e.name));
        }
    } catch {
        /* ignore */
    }
    const gt = gitTopLevel(start);
    if (gt) tryAddEngineCandidate(set, path.join(gt, 'DeukPack'));
    return [...set].sort();
}

function findDeukPackRootFrom(startDir) {
    const c = discoverDeukPackCandidates(startDir);
    return c.length > 0 ? c[0] : null;
}

function gitTopLevel(cwd) {
    const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        encoding: 'utf8',
        shell: true
    });
    if (r.status !== 0) return null;
    return (r.stdout || '').trim() || null;
}

function isUnityEditorProjectRoot(dir) {
    const root = path.resolve(dir);
    return (
        fs.existsSync(path.join(root, 'Packages', 'manifest.json')) &&
        fs.existsSync(path.join(root, 'Assets'))
    );
}

function dedupeNormalizedPaths(paths) {
    const m = new Map();
    for (const p of paths) {
        const k = path.normalize(path.resolve(p));
        if (!m.has(k)) m.set(k, path.normalize(p));
    }
    return [...m.values()];
}

/** 샘플 키트·UPM 캐시·에디터 Library 등 비(非)제품 Unity 트리 제외 */
function isLikelyGameUnityProject(absPath) {
    const n = path.normalize(absPath);
    const sep = path.sep;
    if (n.includes(`${sep}node_modules${sep}`)) return false;
    if (n.includes(`${sep}Library${sep}`) || n.endsWith(`${sep}Library`)) return false;
    if (n.includes(`${sep}PackageCache${sep}`)) return false;
    if (n.includes(`${sep}StarterKit${sep}`)) return false;
    if (n.includes(`${sep}TestProjects~${sep}`)) return false;
    return true;
}

/**
 * UPM 패키지 전용 루트(예: DeukNavigation)처럼 cwd에 Unity 에디터 프로젝트가 없을 때,
 * 부모 폴더의 형제 디렉터리를 내려가며 Unity 프로젝트를 찾는다.
 */
function findUnityProjectsNearSiblings(packageLikeRoot, maxDepth) {
    const acc = [];
    const parent = path.dirname(path.resolve(packageLikeRoot));
    const self = path.resolve(packageLikeRoot);
    try {
        const entries = fs.readdirSync(parent, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const n = e.name;
            if (n === 'node_modules' || n === '.git' || n === 'Library') continue;
            const sibling = path.join(parent, n);
            if (path.resolve(sibling) === self) continue;
            findUnityProjectRoots(sibling, maxDepth, 0, acc);
        }
    } catch {
        /* ignore */
    }
    return acc;
}

function findUnityProjectRoots(startDir, maxDepth, depth = 0, acc = []) {
    const root = path.resolve(startDir);
    if (depth > maxDepth) return acc;
    const manifest = path.join(root, 'Packages', 'manifest.json');
    const assets = path.join(root, 'Assets');
    if (fs.existsSync(manifest) && fs.existsSync(assets)) {
        acc.push(root);
        return acc;
    }
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'Library') continue;
        findUnityProjectRoots(path.join(root, e.name), maxDepth, depth + 1, acc);
    }
    return acc;
}

function defaultSubmoduleUrl() {
    try {
        const pkg = require(path.join(__dirname, '..', 'package.json'));
        const u = pkg.repository && pkg.repository.url;
        if (typeof u !== 'string') return 'https://github.com/joygram/DeukPack.git';
        return u.replace(/^git\+/, '').replace(/\.git$/, '') + '.git';
    } catch {
        return 'https://github.com/joygram/DeukPack.git';
    }
}

function ask(rl, question, defaultAnswer) {
    const hint = defaultAnswer != null && defaultAnswer !== '' ? ` [${defaultAnswer}]` : '';
    return new Promise((resolve) => {
        rl.question(`${question}${hint}: `, (line) => {
            const t = (line || '').trim();
            resolve(t === '' ? defaultAnswer : t);
        });
    });
}

function yesish(s, defaultYes) {
    const t = (s || '').toLowerCase();
    if (t === '') return defaultYes;
    return t === 'y' || t === 'yes';
}

/** @returns {'package'|'src'|null} */
function normalizeInstallKindFlag(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    const t = String(raw).trim().toLowerCase();
    if (t === 'src' || t === 'engine' || t === 'checkout') return 'src';
    if (t === 'package' || t === 'registry' || t === 'npm') return 'package';
    console.warn(`[WARN] Unknown --kind "${raw}"; expected package or src. Using package.`);
    return 'package';
}

/**
 * Numbered menu 1..N; returns 1-based index. Invalid input falls back to default1Based.
 */
async function pickMenu1Based(rl, title, choiceLabels, default1Based) {
    console.log(title);
    choiceLabels.forEach((label, i) => console.log(`  ${i + 1}) ${label}`));
    const max = choiceLabels.length;
    const raw = await ask(rl, `Choice (1-${max})`, String(default1Based));
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > max) return default1Based;
    return n;
}

async function pickEngineRootInteractive(rl, cwd, opts) {
    if (opts.engineRoot) {
        const r = path.resolve(opts.engineRoot);
        if (!validateEngineRoot(r)) {
            console.error('[ERROR] Invalid --engine-root (missing DeukPack.Protocol.csproj):', r);
            process.exit(1);
        }
        return r;
    }

    const cands = discoverDeukPackCandidates(cwd);
    const labels = cands.map((p) => p);
    labels.push('Type path manually');
    labels.push('Run git submodule add … at git repository root');

    const defaultPick = cands.length > 0 ? 1 : labels.length - 1;
    const n = await pickMenu1Based(rl, 'DeukPack engine root:', labels, defaultPick);

    if (n <= cands.length) return cands[n - 1];

    if (n === cands.length + 1) {
        const p = await ask(rl, 'Absolute or relative path to DeukPack engine root', '');
        const r = path.resolve(cwd, p);
        if (!validateEngineRoot(r)) {
            console.error('[ERROR] Path is not a valid DeukPack engine root:', r);
            process.exit(1);
        }
        return r;
    }

    const subUrl = defaultSubmoduleUrl();
    const wantSub = await ask(
        rl,
        `Run "git submodule add ${subUrl} DeukPack" from repository root?`,
        opts.yes ? 'Y' : 'N'
    );
    if (!yesish(wantSub, opts.yes)) {
        console.error('[ERROR] Submodule declined. Pick another engine root option or re-run with --engine-root.');
        process.exit(1);
    }
    const top = gitTopLevel(cwd) || cwd;
    const targetPath = path.join(top, 'DeukPack');
    if (fs.existsSync(targetPath)) {
        console.log('[INFO] Path already exists:', targetPath);
        if (validateEngineRoot(targetPath)) return path.normalize(targetPath);
        console.error('[ERROR] Folder exists but is not a valid DeukPack engine root:', targetPath);
        process.exit(1);
    }
    const r = spawnSync('git', ['submodule', 'add', subUrl, 'DeukPack'], {
        cwd: top,
        stdio: 'inherit',
        shell: true
    });
    if (r.status !== 0 || !validateEngineRoot(targetPath)) {
        console.error('[ERROR] Submodule add failed or tree is not a valid engine root.');
        process.exit(1);
    }
    return path.normalize(targetPath);
}

async function pickUnityProjectsInteractive(rl, found) {
    console.log('Unity projects (Packages/manifest.json + Assets):');
    found.forEach((p, i) => console.log(`  ${i + 1}) ${p}`));
    const menuLabels = [
        'All listed projects',
        ...found.map((p) => `Only: ${p}`),
        'Custom — enter comma-separated numbers (1-based), e.g. 1,3'
    ];
    const n = await pickMenu1Based(rl, 'Which Unity projects should the manifest include?', menuLabels, 1);
    if (n === 1) return found;
    if (n >= 2 && n <= found.length + 1) return [found[n - 2]];
    const line = await ask(rl, 'Comma-separated project numbers (1-based)', '1');
    const idx = line
        .split(/[, ]+/)
        .map((x) => parseInt(x, 10))
        .filter((k) => !Number.isNaN(k) && k >= 1 && k <= found.length)
        .map((k) => k - 1);
    const out = idx.map((i) => found[i]).filter(Boolean);
    return out.length > 0 ? out : found;
}

async function main(argv) {
    const opts = parseArgs(argv);
    if (opts.help) {
        console.log(`Usage: npx deukpack bootstrap [options]

Writes ./${MANIFEST_DIR}/${MANIFEST_NAME}. Interactive mode uses numbered choices for engine root and Unity projects.
Default install kind is package unless --kind src is passed (--engine-root alone does not select src).

Options:
  --kind package|src             default: package; src = engine checkout + sync (aliases: registry|npm → package)
  --engine-root <path>           DeukPack engine repo (used only with --kind src)
  --deukpack-root <path>         Same as --engine-root
  -o, --manifest-out <dir>       Directory for ${MANIFEST_DIR}/ (default: cwd)
  -y, --yes                      Default yes for submodule prompt (non-interactive)
  --non-interactive              Never prompt (CI, automation)
  --no-unity                     Skip Unity scan
  --skip-vsix                    Skip bundled Deuk IDL VSIX install (default: always attempt install)`);

        return;
    }

    const cwd = process.cwd();
    const tty = !opts.nonInteractive && process.stdin.isTTY && process.stdout.isTTY;

    let installKind = normalizeInstallKindFlag(opts.kind);
    if (installKind === null) installKind = 'package';

    let deukPackRoot = null;
    let rl = null;
    if (tty) {
        rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }

    if (tty && rl) {
        if (installKind === 'src') {
            deukPackRoot = await pickEngineRootInteractive(rl, cwd, opts);
        } else if (opts.engineRoot) {
            console.warn('[WARN] --engine-root ignored unless --kind src.');
        }
        rl.close();
        rl = null;
    } else {
        if (installKind === 'package' && opts.engineRoot) {
            console.warn('[WARN] --engine-root ignored unless --kind src.');
        }
        if (installKind === 'src') {
            deukPackRoot = opts.engineRoot ? path.resolve(opts.engineRoot) : findDeukPackRootFrom(cwd);
            if (!deukPackRoot || !validateEngineRoot(deukPackRoot)) {
                console.error(
                    '[ERROR] --kind src requires --engine-root <path> or cwd where discoverDeukPackCandidates finds the repo.'
                );
                process.exit(1);
            }
        }
    }

    let unityProjects = [];
    if (!opts.skipUnity) {
        let found = findUnityProjectRoots(cwd, 6);
        if (!isUnityEditorProjectRoot(cwd)) {
            found = dedupeNormalizedPaths([...found, ...findUnityProjectsNearSiblings(cwd, 5)]);
        }
        found = found.filter(isLikelyGameUnityProject);
        if (found.length === 0) {
            console.log('[INFO] No Unity projects detected (cwd and sibling folders).');
        } else if (tty) {
            const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
            unityProjects = await pickUnityProjectsInteractive(rl2, found);
            rl2.close();
        } else {
            unityProjects = found;
        }
    }

    const baseOut = opts.manifestOut ? path.resolve(opts.manifestOut) : cwd;
    const deukpackDir = path.join(baseOut, MANIFEST_DIR);
    fs.mkdirSync(deukpackDir, { recursive: true });
    const manifestPath = path.join(deukpackDir, MANIFEST_NAME);

    const manifest = {
        schemaVersion: 1,
        installKind,
        ...(installKind === 'src' && deukPackRoot
            ? { deukPackRoot: path.normalize(deukPackRoot) }
            : {}),
        unity: {
            projects: unityProjects.map((projectRoot) => ({
                projectRoot: path.normalize(projectRoot)
            })),
            runtimePluginsOut: 'upm/Runtime/Plugins'
        },
        sync: {
            cli: 'npx deukpack sync',
            buildScript: 'scripts/build_unity_runtime_plugins.js'
        },
        bootstrap: {
            cli: 'npx deukpack bootstrap'
        }
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('[OK] Wrote', manifestPath);

    if (!opts.skipVsix) {
        const vsixMod = require('./bundled-deuk-idl-vsix.js');
        const hasUnity =
            unityProjects.length > 0 || vsixMod.hasUnityProjectNear(baseOut);
        await vsixMod.applyBundledVsixInstall(baseOut, { hasUnityProject: hasUnity });
    }

    if (installKind === 'src') {
        console.log(
            '[INFO] After engine changes: `npx deukpack sync` (or your game build script).'
        );
    }
}

module.exports = {
    main,
    findDeukPackRootFrom,
    discoverDeukPackCandidates,
    findUnityProjectRoots,
    isUnityEditorProjectRoot,
    findUnityProjectsNearSiblings
};

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
