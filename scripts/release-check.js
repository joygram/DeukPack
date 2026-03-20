#!/usr/bin/env node
/**
 * OSS/릴리스 전 버전·일치 검사. 실패 시 exit 1.
 * - package.json version 형식 (semver)
 * - package-lock.json root version과 package.json 일치
 */
const fs = require('fs');
const path = require('path');

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
