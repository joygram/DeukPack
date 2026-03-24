#!/usr/bin/env node
/** Align version artifacts (changelog slices, package-lock, release-notice) with package.json version. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function readPkg() {
  const p = path.join(root, 'package.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function syncReleaseChangelogs() {
  const slice = path.join(root, 'scripts/changelog-release-slice.js');
  const r = spawnSync(process.execPath, [slice], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function syncPackageLock() {
  const r = spawnSync(
    'npm',
    ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: root, stdio: 'inherit', shell: true }
  );
  if (r.status !== 0) {
    console.error('❌ package-lock update failed. Run `npm install` manually.');
    process.exit(r.status || 1);
  }
  console.log('✓ package-lock.json (root version)');
}

function syncReleaseNoticeVersion(ver) {
  const noticePath = path.join(root, 'release-notice.json');
  if (!fs.existsSync(noticePath)) return;
  const raw = fs.readFileSync(noticePath, 'utf8');
  const notice = JSON.parse(raw);
  if (notice.version === ver) {
    console.log('✓ release-notice.json version', ver);
    return;
  }
  notice.version = ver;
  fs.writeFileSync(noticePath, JSON.stringify(notice, null, 2) + '\n', 'utf8');
  console.log('✓ release-notice.json version →', ver);
}

function main() {
  const pkg = readPkg();
  const ver = pkg.version;
  if (!ver || typeof ver !== 'string') {
    console.error('❌ package.json: version missing');
    process.exit(1);
  }

  console.log('📌 version:sync —', ver);
  syncReleaseChangelogs();
  syncPackageLock();
  syncReleaseNoticeVersion(ver);

  const rc = spawnSync(process.execPath, ['scripts/release-check.js'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (rc.status !== 0) process.exit(rc.status || 1);

  console.log('');
  console.log('✅ Version artifacts updated.');
  if (process.env.npm_lifecycle_event === 'postversion') {
    console.log('');
    console.log('   Stage and amend the version commit:');
    console.log('   git add package-lock.json CHANGELOG.release.md CHANGELOG.release.ko.md release-notice.json');
    console.log('   git commit --amend --no-edit');
  }
}

main();
