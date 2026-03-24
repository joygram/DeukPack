#!/usr/bin/env node
/**
 * package.json version에 해당하는 CHANGELOG 섹션만 발췌해 npm tarball에 포함할 파일을 씁니다.
 * prepublishOnly에서 호출. 실패 시 exit 1.
 */
const fs = require('fs');
const path = require('path');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string[]} lines
 * @param {string} version semver from package.json
 * @returns {string | null}
 */
function extractChangelogSection(lines, version) {
  const headerRe = new RegExp(`^## \\[${escapeRegExp(version)}\\]`);
  let i = 0;
  for (; i < lines.length; i++) {
    if (headerRe.test(lines[i])) break;
  }
  if (i >= lines.length) return null;
  const chunk = [lines[i]];
  i++;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^## \[/.test(line)) break;
    if (line.trim() === '---') break;
    chunk.push(line);
  }
  return chunk.join('\n').trimEnd();
}

function writeReleaseFile(root, filename, introLines, section) {
  const body = [...introLines, '', '---', '', section, ''].join('\n');
  fs.writeFileSync(path.join(root, filename), body, 'utf8');
}

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const ver = pkg.version;
  if (!ver) {
    console.error('❌ package.json: version 없음');
    process.exit(1);
  }

  const enPath = path.join(root, 'CHANGELOG.md');
  const koPath = path.join(root, 'CHANGELOG.ko.md');
  const enBody = fs.readFileSync(enPath, 'utf8');
  const enLines = enBody.split(/\r?\n/);
  const enSection = extractChangelogSection(enLines, ver);
  if (!enSection) {
    console.error(`❌ CHANGELOG.md에 ## [${ver}] 섹션이 없습니다. 릴리스 전에 changelog를 채우세요.`);
    process.exit(1);
  }

  writeReleaseFile(root, 'CHANGELOG.release.md', [
    `# Release notes — deukpack@${ver}`,
    '',
    `Excerpt for this npm version only. Full history: **CHANGELOG.md** (also in this package).`,
  ], enSection);

  if (fs.existsSync(koPath)) {
    const koBody = fs.readFileSync(koPath, 'utf8');
    const koLines = koBody.split(/\r?\n/);
    const koSection = extractChangelogSection(koLines, ver);
    if (!koSection) {
      console.error(`❌ CHANGELOG.ko.md에 ## [${ver}] 섹션이 없습니다.`);
      process.exit(1);
    }
    writeReleaseFile(root, 'CHANGELOG.release.ko.md', [
      `# 릴리스 노트 — deukpack@${ver}`,
      '',
      `이번 npm 버전만 발췌했습니다. 전체 이력은 **CHANGELOG.ko.md**(동일 패키지에 포함)를 보세요.`,
    ], koSection);
  }

  console.log('✓ CHANGELOG.release.md · CHANGELOG.release.ko.md (' + ver + ')');
}

module.exports = { extractChangelogSection, escapeRegExp };

if (require.main === module) {
  main();
}
