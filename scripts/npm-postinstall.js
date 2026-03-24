#!/usr/bin/env node
/**
 * npm lifecycle: after `npm i deukpack` in a consumer project, print a one-time-style hint
 * when neither `deukpack.pipeline.json` nor `.deukpack/workspace.json` exists yet.
 * Full setup (pipeline, workspace bootstrap, VSIX last): `npx deukpack init`.
 *
 * Skip: global install, DEUKPACK_SKIP_POSTINSTALL=1, installing into the deukpack package itself, CI.
 */

const fs = require('fs');
const path = require('path');

if (process.env.DEUKPACK_SKIP_POSTINSTALL === '1') process.exit(0);
if (process.env.npm_config_global === 'true') process.exit(0);

const initCwd = process.env.INIT_CWD || process.env.npm_config_local_prefix || '';
if (!initCwd || !fs.existsSync(initCwd)) process.exit(0);

try {
    const pkgPath = path.join(initCwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg && pkg.name === 'deukpack') process.exit(0);
    }
} catch {
    /* ignore */
}

if (process.env.CI === 'true' || process.env.CI === '1') process.exit(0);

const pipelinePath = path.join(initCwd, 'deukpack.pipeline.json');
const workspacePath = path.join(initCwd, '.deukpack', 'workspace.json');
if (fs.existsSync(pipelinePath) || fs.existsSync(workspacePath)) process.exit(0);

console.log(
    '[deukpack] This project has no DeukPack pipeline or workspace manifest yet. Run:\n' +
        '  npx deukpack init\n' +
        'to configure deukpack.pipeline.json (codegen), .deukpack/workspace.json (bootstrap), then Deuk IDL VSIX.\n' +
        'Suppress: DEUKPACK_SKIP_POSTINSTALL=1, or add deukpack.pipeline.json or .deukpack/workspace.json.'
);
