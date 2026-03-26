#!/usr/bin/env node
/**
 * Invoke DeukPack CLI from a consumer repo (same pattern as CI).
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const buildScript = path.join(root, 'scripts', 'build_deukpack.js');
const idl = path.join(root, 'examples', 'sample_idl', 'sample.thrift');
const out = path.join(root, 'examples', 'generated');

// 기본은 득팩 전용 pack. 호환(Thrift) 코드젠 힌트가 필요하면 --protocol tbinary|tcompact|tjson.
const r = spawnSync(process.execPath, [buildScript, idl, out, '--js', '--protocol', 'pack'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
