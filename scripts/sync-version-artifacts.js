#!/usr/bin/env node
/**
 * package.json version 기준으로 버전·이력 산출물을 맞춘다.
 * - CHANGELOG.release.md / CHANGELOG.release.ko.md (changelog-release-slice)
 * - package-lock.json 루트 version (npm install --package-lock-only)
 * - release-notice.json 최상위 version (불일치 시 갱신)
 *
 * 수동: npm run version:sync
 * npm version 직후: postversion 훅으로 실행되며, 출력된 git 안내로 amend 권장.
 */
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
    console.error('❌ package-lock 갱신 실패. `npm install` 로 수동 확인.');
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
  console.log('✓ release-notice.json version →', ver, '(상위 필드만; announce/landing/product 문구는 별도 편집)');
}

function main() {
  const pkg = readPkg();
  const ver = pkg.version;
  if (!ver || typeof ver !== 'string') {
    console.error('❌ package.json: version 없음');
    process.exit(1);
  }

  console.log('📌 sync-version-artifacts —', ver);
  syncReleaseChangelogs();
  syncPackageLock();
  syncReleaseNoticeVersion(ver);

  const rc = spawnSync(process.execPath, ['scripts/release-check.js'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (rc.status !== 0) process.exit(rc.status || 1);

  console.log('');
  console.log('✅ 버전 산출물 동기화 완료.');
  if (process.env.npm_lifecycle_event === 'postversion') {
    console.log('');
    console.log('   `npm version` 직후라면 스테이징 후 커밋에 포함하세요:');
    console.log('   git add package-lock.json CHANGELOG.release.md CHANGELOG.release.ko.md release-notice.json');
    console.log('   git commit --amend --no-edit');
  }
}

main();
