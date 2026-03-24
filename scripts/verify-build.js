#!/usr/bin/env node
/**
 * CI 파이프라인과 동일한 빌드 검증 스크립트.
 * GitHub Actions에서 수행하는 모든 검사를 로컬에서 실행.
 *
 * Usage: node scripts/verify-build.js [--skip-test] [--skip-codegen]
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
process.chdir(root);

const args = process.argv.slice(2);
const skipTest = args.includes('--skip-test');
const skipCodegen = args.includes('--skip-codegen');

let failed = false;
const results = [];

function run(label, cmd, opts = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log(`  $ ${cmd}`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  try {
    const result = execSync(cmd, {
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: opts.cwd || root,
      ...opts
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Check for warnings in output
    const output = result || '';
    const warningMatch = output.match(/경고\s+(\d+)개|(\d+)\s+warning/i);
    const warnings = warningMatch ? parseInt(warningMatch[1] || warningMatch[2], 10) : 0;
    
    if (warnings > 0 && opts.failOnWarning) {
      console.log(output);
      console.error(`❌ ${label}: ${warnings} warnings (expected 0)`);
      results.push({ label, status: 'WARN', warnings, elapsed });
      failed = true;
    } else {
      console.log(`✓ ${label} (${elapsed}s)`);
      if (warnings > 0) {
        console.log(`  (${warnings} warnings)`);
      }
      results.push({ label, status: 'OK', warnings, elapsed });
    }
    return { success: true, output, warnings };
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);
    console.error(`❌ ${label}: FAILED (${elapsed}s)`);
    results.push({ label, status: 'FAIL', elapsed });
    failed = true;
    return { success: false, output };
  }
}

function runWithWarningCheck(label, cmd, opts = {}) {
  return run(label, cmd, { ...opts, failOnWarning: true });
}

console.log('🔍 DeukPack Build Verification');
console.log(`   (matches CI pipeline checks)`);
console.log(`   Root: ${root}`);
console.log(`   Skip test: ${skipTest}`);
console.log(`   Skip codegen: ${skipCodegen}`);

// 1. TypeScript build
run('TypeScript compile', 'npx tsc --noEmit');

// 2. Full npm build (TS + C# + templates)
run('npm run build', 'npm run build');

// 3. C# Protocol build with warning check (all TFMs)
runWithWarningCheck(
  'C# DeukPack.Protocol (all TFMs, 0 warnings)',
  'dotnet build -c Release --no-incremental',
  { cwd: path.join(root, 'DeukPack.Protocol') }
);

// 4. C# ExcelProtocol build with warning check
runWithWarningCheck(
  'C# DeukPack.ExcelProtocol (0 warnings)',
  'dotnet build -c Release --no-incremental',
  { cwd: path.join(root, 'DeukPack.ExcelProtocol') }
);

// 5. Example consumer-csharp (all TFMs, 0 warnings)
if (!skipCodegen) {
  const sampleCsharp = path.join(root, 'examples/consumer-csharp');
  if (fs.existsSync(path.join(sampleCsharp, 'TutorialSample.csproj'))) {
    runWithWarningCheck(
      'C# consumer-csharp sample (all TFMs, 0 warnings)',
      'dotnet build -c Release --no-incremental',
      { cwd: sampleCsharp }
    );
  }
} else {
  console.log('\n⏭  Skipping consumer-csharp (--skip-codegen)');
  results.push({ label: 'C# consumer-csharp sample', status: 'SKIP' });
}

// 6a. Jest tests
if (!skipTest) {
  run('npm test (Jest)', 'npm test');
} else {
  console.log('\n⏭  Skipping tests (--skip-test)');
  results.push({ label: 'npm test', status: 'SKIP' });
}

// 6. npm pack dry-run
run('npm pack --dry-run', 'npm pack --dry-run');

// 7. Example IDL codegen smoke test
if (!skipCodegen) {
  const sampleIdl = path.join(root, 'examples/sample_idl/sample.thrift');
  const outDir = path.join(root, 'examples/out-verify');
  if (fs.existsSync(sampleIdl)) {
    run(
      'Example IDL codegen (C#/JS smoke)',
      `node scripts/build_deukpack.js "${sampleIdl}" "${outDir}" --csharp --js --protocol tbinary --allow-multi-namespace`
    );
    // Cleanup
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch {}
  } else {
    console.log('\n⏭  Skipping codegen (sample IDL not found)');
    results.push({ label: 'Example IDL codegen', status: 'SKIP' });
  }
} else {
  console.log('\n⏭  Skipping codegen (--skip-codegen)');
  results.push({ label: 'Example IDL codegen', status: 'SKIP' });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));
for (const r of results) {
  const status = r.status === 'OK' ? '✓' : r.status === 'SKIP' ? '⏭' : '❌';
  const warn = r.warnings > 0 ? ` (${r.warnings} warnings)` : '';
  const time = r.elapsed ? ` ${r.elapsed}s` : '';
  console.log(`  ${status} ${r.label}${warn}${time}`);
}
console.log('='.repeat(60));

if (failed) {
  console.error('\n❌ Build verification FAILED');
  process.exit(1);
} else {
  console.log('\n✅ Build verification PASSED');
  process.exit(0);
}
