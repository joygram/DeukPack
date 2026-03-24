#!/usr/bin/env node
/**
 * OSS/릴리스 전 버전·일치 검사. 실패 시 exit 1.
 * - package.json version 형식 (semver)
 * - package-lock.json root version과 package.json 일치
 */
const fs = require('fs');
const path = require('path');
const { extractChangelogSection } = require('./changelog-release-slice.js');
const { PRODUCT_NOTICE_KEYS } = require('./apply-release-notice.js');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const ver = pkg.version;

if (!ver || typeof ver !== 'string') {
  console.error('❌ package.json: version 없음');
  process.exit(1);
}

const semver = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
if (!semver.test(ver)) {
  console.error('❌ package.json version 형식 오류 (semver 필요):', ver);
  process.exit(1);
}

let lockVer = null;
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lockVer = lock.version || (lock.packages && lock.packages[''] && lock.packages[''].version);
  if (lockVer && lockVer !== ver) {
    console.error('❌ 버전 불일치: package.json=', ver, ', package-lock.json=', lockVer);
    console.error('   npm install 로 lock 갱신 후 다시 시도.');
    process.exit(1);
  }
}

console.log('✓ 버전', ver, '(package.json' + (lockVer ? ', package-lock 일치' : '') + ')');

const noticePath = path.join(root, 'release-notice.json');
if (fs.existsSync(noticePath)) {
  const notice = JSON.parse(fs.readFileSync(noticePath, 'utf8'));
  if (notice.version !== ver) {
    console.error(
      '❌ release-notice.json version 과 package.json 불일치:',
      notice.version,
      '≠',
      ver,
      '→ 갱신 후 다시 시도.'
    );
    process.exit(1);
  }
  console.log('✓ release-notice.json version', notice.version);
  if (Array.isArray(notice.product_notices)) {
    const allowed = new Set(PRODUCT_NOTICE_KEYS);
    for (let i = 0; i < notice.product_notices.length; i++) {
      const row = notice.product_notices[i];
      if (!row || !Array.isArray(row.products)) continue;
      for (const p of row.products) {
        if (!allowed.has(p)) {
          console.error(
            '❌ release-notice.json product_notices[' + i + '] 허용되지 않은 products 키:',
            p,
            '→',
            [...allowed].join(', ')
          );
          process.exit(1);
        }
      }
    }
    console.log('✓ release-notice.json product_notices 키 검사');
  }
}

const changelogPath = path.join(root, 'CHANGELOG.md');
const changelogKoPath = path.join(root, 'CHANGELOG.ko.md');
if (fs.existsSync(changelogPath)) {
  const lines = fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/);
  if (!extractChangelogSection(lines, ver)) {
    console.error('❌ CHANGELOG.md에 ## [' + ver + '] 섹션이 없습니다. npm 배포 전에 해당 버전 항목을 추가하세요.');
    process.exit(1);
  }
  console.log('✓ CHANGELOG.md ## [' + ver + ']');
}
if (fs.existsSync(changelogKoPath)) {
  const koLines = fs.readFileSync(changelogKoPath, 'utf8').split(/\r?\n/);
  if (!extractChangelogSection(koLines, ver)) {
    console.error('❌ CHANGELOG.ko.md에 ## [' + ver + '] 섹션이 없습니다.');
    process.exit(1);
  }
  console.log('✓ CHANGELOG.ko.md ## [' + ver + ']');
}
