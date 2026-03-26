#!/usr/bin/env node
/**
 * Run generated JS: WriteWithOverrides, WriteFields, FieldId.
 * Prerequisite: npm run codegen (or gen-sample from repo root).
 */
const path = require('path');

const genPath = path.join(__dirname, '..', '..', 'generated', 'js', 'generated_deuk.js');
let gen;
try {
  gen = require(genPath);
} catch (e) {
  console.error('Generated file not found. Run: npm run codegen');
  process.exit(1);
}

const { DemoUser, UserRecord } = gen;

// WriteWithOverrides: same object, different Name per "recipient"
const msg = { id: 1, name: 'shared', home: { x: 10, y: 20 } };
const jsonAlice = DemoUser.toJsonWithOverrides(msg, { [DemoUser.FieldId.Name]: 'Alice' });
const jsonBob = DemoUser.toJsonWithOverrides(msg, { [DemoUser.FieldId.Name]: 'Bob' });
console.log('[WriteWithOverrides] Alice:', jsonAlice.slice(0, 80) + '...');
console.log('[WriteWithOverrides] Bob:', jsonBob.slice(0, 80) + '...');

// WriteFields (projection): full UserRecord, emit only Id, DisplayName, Level
const fullRecord = { id: 10, displayName: 'Bob', level: 5, avatarUrl: 'https://example.com/avatar.png' };
const F = UserRecord.FieldId;
const jsonPartial = UserRecord.toJsonWithFields(fullRecord, [F.Id, F.DisplayName, F.Level]);
console.log('[toJsonWithFields] partial:', jsonPartial);

// projectFields: object with only selected fields
const partialObj = UserRecord.projectFields(fullRecord, [F.Id, F.DisplayName]);
console.log('[projectFields]', partialObj);

console.log('OK');
