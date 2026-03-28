#!/usr/bin/env node
/**
 * Smoke: run thrift-to-deuk.js on a tiny fixture and require at least one .deuk output.
 * Used by npm run test:idl-convert-smoke and verify-build.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const fixtureDir = path.join(__dirname, '__fixtures__', 'smoke');
const entry = path.join(fixtureDir, 'entry.thrift');
const converter = path.join(__dirname, 'thrift-to-deuk.js');

if (!fs.existsSync(entry)) {
  console.error('[smoke-thrift-to-deuk] missing fixture:', entry);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deuk-thrift-smoke-'));
try {
  const r = spawnSync(
    process.execPath,
    [converter, '--source-root', fixtureDir, '--entry', entry, '--out-dir', tmp, '--deukpack-dir', root],
    { cwd: root, stdio: 'inherit' }
  );
  if (r.status !== 0) process.exit(r.status == null ? 1 : r.status);

  const deuk = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.deuk')) deuk.push(p);
    }
  }
  walk(tmp);
  if (deuk.length === 0) {
    console.error('[smoke-thrift-to-deuk] no .deuk files under', tmp);
    process.exit(1);
  }
  console.log('[smoke-thrift-to-deuk] ok,', deuk.length, '.deuk file(s)');
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
}
