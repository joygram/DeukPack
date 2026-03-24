#!/usr/bin/env node
/**
 * DeukPack CLI (project-local npm / npx).
 * Subcommands: help, init, config, run, build (optional), bootstrap (= init --workspace-only), sync-runtime. Otherwise codegen driver (build_deukpack.js).
 */
const path = require('path');
const fs = require('fs');
let args = process.argv.slice(2);
const cmd = args[0];
const buildScript = path.join(__dirname, '..', 'scripts', 'build_deukpack.js');

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    const { printCliUsage } = require(buildScript);
    const full = args.includes('--full');
    printCliUsage({ full, useStdout: true });
    process.exit(0);
}

if (args.length === 0) {
    const { printCliUsage } = require(buildScript);
    printCliUsage({ full: false, useStdout: false });
    process.exit(1);
}

if (cmd === 'init' || cmd === 'config') {
    const { main } = require(path.join(__dirname, '..', 'scripts', 'deukpack_init.js'));
    main(args.slice(1)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
} else if (cmd === 'run') {
    const { main } = require(buildScript);
    const rest = args.slice(1);
    const cfgPath = rest[0]
        ? path.resolve(process.cwd(), rest[0])
        : path.join(process.cwd(), 'deukpack.pipeline.json');
    if (!fs.existsSync(cfgPath)) {
        console.error(`No pipeline file: ${cfgPath}`);
        console.error('Create one with: deukpack init');
        process.exit(1);
    }
    main(['--pipeline', cfgPath]).catch((e) => {
        console.error(e);
        process.exit(1);
    });
} else if (cmd === 'bootstrap') {
    const { main: initMain } = require(path.join(__dirname, '..', 'scripts', 'deukpack_init.js'));
    initMain(['--workspace-only', ...args.slice(1)]).catch((e) => {
        console.error(e);
        process.exit(1);
    });
} else if (cmd === 'sync-runtime') {
    const { main } = require(path.join(__dirname, '..', 'scripts', 'sync_workspace_runtime.js'));
    main(args.slice(1)).catch((e) => {
        console.error(e);
        process.exit(1);
    });
} else {
    if (cmd === 'build') {
        args = args.slice(1);
    }
    const { main } = require(buildScript);
    main(args).catch(console.error);
}
