#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    skipRoundtrip: false,
    skipSecurity: false,
    skipPerf: false,
    skipBuild: false,
    benchRowsList: '1000,10000',
    benchColumns: '8',
    benchSeed: '42',
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--skip-roundtrip') args.skipRoundtrip = true;
    else if (token === '--skip-security') args.skipSecurity = true;
    else if (token === '--skip-perf') args.skipPerf = true;
    else if (token === '--skip-build') args.skipBuild = true;
    else if (token.startsWith('--bench-rows-list=')) args.benchRowsList = token.slice('--bench-rows-list='.length);
    else if (token === '--bench-rows-list' && argv[i + 1]) args.benchRowsList = argv[++i];
    else if (token.startsWith('--bench-columns=')) args.benchColumns = token.slice('--bench-columns='.length);
    else if (token === '--bench-columns' && argv[i + 1]) args.benchColumns = argv[++i];
    else if (token.startsWith('--bench-seed=')) args.benchSeed = token.slice('--bench-seed='.length);
    else if (token === '--bench-seed' && argv[i + 1]) args.benchSeed = argv[++i];
  }

  return args;
}

function runStep(stepName, command, args, options = {}) {
  process.stdout.write(`\n[RUN] ${stepName}\n`);
  process.stdout.write(`      ${command} ${args.join(' ')}\n`);

  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: options.shell === true,
    env: options.env || process.env,
  });

  return {
    stepName,
    command: `${command} ${args.join(' ')}`,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: Date.now() - startedAt,
  };
}

function writeReport(report) {
  const outDir = path.join(root, 'benchmarks', 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const reportPath = path.join(outDir, 'roundtrip-security-perf-last.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

function summarize(report, reportPath) {
  process.stdout.write('\n========================================\n');
  process.stdout.write('DeukPack Roundtrip/Security/Perf Summary\n');
  process.stdout.write('========================================\n');

  for (const step of report.steps) {
    process.stdout.write(
      `- ${step.stepName}: ${step.status.toUpperCase()} (exit=${step.exitCode}, ${step.durationMs}ms)\n`
    );
  }

  process.stdout.write(`\nResult: ${report.status.toUpperCase()}\n`);
  process.stdout.write(`Report: ${path.relative(root, reportPath)}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  const steps = [];

  if (!args.skipRoundtrip) {
    steps.push(runStep('All protocols roundtrip', 'node', ['scripts/test-roundtrip-all-protocols.js']));
  }

  if (!args.skipSecurity) {
    steps.push(runStep('SecurityChecks', 'npm', ['test', '--', 'SecurityChecks'], { shell: process.platform === 'win32' }));

    steps.push(runStep('wireSerializeApi', 'npm', ['test', '--', 'wireSerializeApi'], { shell: process.platform === 'win32' }));

    steps.push(runStep('protoGoogleInterop', 'npm', ['test', '--', 'protoGoogleInterop'], { shell: process.platform === 'win32' }));
  }

  if (!args.skipPerf) {
    const perfArgs = ['scripts/run-bench-e2e-roundtrip.js'];
    if (args.skipBuild) perfArgs.push('--skip-build');
    perfArgs.push('--rows-list', args.benchRowsList, '--columns', args.benchColumns, '--seed', args.benchSeed);

    steps.push(runStep('E2E roundtrip benchmark', 'node', perfArgs));
  }

  return finish(args, steps);
}

function finish(args, steps) {
  const status = steps.some((s) => s.status === 'failed') ? 'failed' : 'passed';
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      skipRoundtrip: args.skipRoundtrip,
      skipSecurity: args.skipSecurity,
      skipPerf: args.skipPerf,
      skipBuild: args.skipBuild,
      benchRowsList: args.benchRowsList,
      benchColumns: args.benchColumns,
      benchSeed: args.benchSeed,
    },
    status,
    steps,
  };

  const reportPath = writeReport(report);
  summarize(report, reportPath);

  process.exit(status === 'passed' ? 0 : 1);
}

main();
