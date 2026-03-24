#!/usr/bin/env node
/**
 * release-notice.json → MkDocs announce banner + docs/_includes notices.
 *
 * 사용 예:
 *   node scripts/apply-release-notice.js
 *   node scripts/apply-release-notice.js --json ./release-notice.json --mkdocs mkdocs.yml --write-includes docs/_includes --product-notices
 */
const fs = require('fs');
const path = require('path');

const PRODUCT_NOTICE_KEYS = [
  'core-engine',
  'protocol',
  'excel-addin',
  'pipeline-unity',
  'navigation',
  'extension',
];

const PRODUCT_LABELS_KO = {
  'core-engine': '득팩 코어·엔진',
  protocol: '득팩 프로토콜',
  'excel-addin': '득팩 Excel 애드인',
  'pipeline-unity': '득팩 파이프라인·Unity',
  navigation: 'DeukNavigation',
  extension: '확장 제품군',
};

const PRODUCT_LABELS_EN = {
  'core-engine': 'Core · engine',
  protocol: 'Protocol',
  'excel-addin': 'Excel add-in',
  'pipeline-unity': 'Pipeline · Unity',
  navigation: 'DeukNavigation',
  extension: 'Extension',
};

function parseArgs(argv) {
  const out = {
    json: null,
    mkdocs: null,
    includesDir: null,
    skipMkdocs: false,
    skipIncludes: false,
    productNotices: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = argv[++i];
    else if (a === '--mkdocs') out.mkdocs = argv[++i];
    else if (a === '--write-includes') out.includesDir = argv[++i];
    else if (a === '--skip-mkdocs') out.skipMkdocs = true;
    else if (a === '--skip-includes') out.skipIncludes = true;
    else if (a === '--product-notices') out.productNotices = true;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node apply-release-notice.js [options]
  --json PATH          release-notice.json (default: <DeukPack>/release-notice.json)
  --mkdocs PATH        mkdocs.yml to patch (optional)
  --write-includes DIR docs/_includes output dir (optional)
  --product-notices    deukpack.app 전용: 제품군 집계·랜딩 스니펫 생성
  --skip-mkdocs        only write includes
  --skip-includes      only patch mkdocs`);
      process.exit(0);
    }
  }
  return out;
}

const SCRIPT_DIR = path.dirname(__filename);
const DEUKPACK_ROOT = path.join(SCRIPT_DIR, '..');

function defaultJsonPath() {
  return path.join(DEUKPACK_ROOT, 'release-notice.json');
}

function indentForAdmonition(md) {
  return md
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.length ? '    ' + line : line))
    .join('\n');
}

function buildLandingAdmonition(title, version, bodyMd) {
  const t = (title || '득팩 코어 업데이트').trim();
  const v = (version || '').trim();
  const head = v ? `!!! info "${t} — ${v}"` : `!!! info "${t}"`;
  return `${head}\n${indentForAdmonition(bodyMd)}\n`;
}

function announceYamlBlock(announceHtml) {
  const lines = announceHtml.split(/\r?\n/).filter((l, i, arr) => !(l === '' && i === arr.length - 1));
  const body = lines.map((l) => `    ${l}`).join('\n');
  return `  announce: >-\n${body}`;
}

function sortedProductNotices(data) {
  const raw = data.product_notices;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((n, idx) => ({ ...n, _ord: idx }))
    .filter((n) => n.date && typeof n.date === 'string' && Array.isArray(n.products) && n.products.length > 0)
    .sort((a, b) => {
      const c = String(b.date).localeCompare(String(a.date));
      return c !== 0 ? c : a._ord - b._ord;
    });
}

function formatProductLine(notice, lang) {
  const labels = lang === 'ko' ? PRODUCT_LABELS_KO : PRODUCT_LABELS_EN;
  const sep = lang === 'ko' ? ' · ' : ' · ';
  return notice.products.map((p) => labels[p] || p).join(sep);
}

function buildAggregateProductNoticesMarkdown(notices, lang) {
  const isKo = lang === 'ko';
  const titleKey = isKo ? 'title_ko' : 'title_en';
  const bodyKey = isKo ? 'body_ko' : 'body_en';
  const h2 = isKo ? '## 제품군 노티 (날짜 역순)' : '## Product-line notices (newest first)';
  if (notices.length === 0) {
    return `${h2}\n\n${isKo ? '_등록된 제품군 노티가 없습니다._' : '_No product-line notices yet._'}\n`;
  }
  const lines = [h2, ''];
  for (const n of notices) {
    const prodLine = formatProductLine(n, lang);
    lines.push(`### ${n.date} — ${prodLine}`);
    lines.push('');
    lines.push(`**${n[titleKey] || ''}**`);
    lines.push('');
    const body = (n[bodyKey] || '').trim();
    if (body) lines.push(body);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

function buildProductLandingMarkdown(notices, slug, lang) {
  const isKo = lang === 'ko';
  const filtered = notices.filter((n) => n.products.includes(slug));
  if (filtered.length === 0) return '<!-- product-notices:empty -->\n';
  const tipTitle = isKo ? '이 제품군 최근 노티' : 'Recent notices (this product line)';
  const titleKey = isKo ? 'title_ko' : 'title_en';
  const bodyKey = isKo ? 'body_ko' : 'body_en';
  const parts = [];
  for (const n of filtered) {
    const head = `**${n.date}** — ${n[titleKey] || ''}`;
    const body = (n[bodyKey] || '').trim();
    const block = body ? `${head}\n\n${body}` : head;
    parts.push(indentForAdmonition(block));
  }
  return `!!! tip "${tipTitle}"\n${parts.join('\n\n')}\n`;
}

function writeProductNoticeIncludes(incDir, data) {
  const notices = sortedProductNotices(data);
  fs.mkdirSync(incDir, { recursive: true });
  fs.writeFileSync(
    path.join(incDir, 'product-notices-aggregate.ko.md'),
    buildAggregateProductNoticesMarkdown(notices, 'ko'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(incDir, 'product-notices-aggregate.en.md'),
    buildAggregateProductNoticesMarkdown(notices, 'en'),
    'utf8'
  );
  for (const slug of PRODUCT_NOTICE_KEYS) {
    fs.writeFileSync(
      path.join(incDir, `product-notices-landing-${slug}.ko.md`),
      buildProductLandingMarkdown(notices, slug, 'ko'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(incDir, `product-notices-landing-${slug}.en.md`),
      buildProductLandingMarkdown(notices, slug, 'en'),
      'utf8'
    );
  }
  console.log('✓ product notices →', incDir);
}

function replaceMkdocsAnnounce(mkdocsText, announceHtml) {
  const text = mkdocsText.replace(/\r\n/g, '\n');
  const block = announceYamlBlock(announceHtml);
  if (/\n  announce: >-\n/.test(text)) {
    return text.replace(/\n  announce: >-\n(?:    [^\n]*\n)+/, `\n${block}\n`);
  }
  const m = text.match(/(extra:\n  generator: false)(?:\n  #[^\n]*)?(\n)/);
  if (m) {
    return text.replace(m[0], `${m[1]}${m[2]}${block}\n`);
  }
  throw new Error('mkdocs.yml: extra.generator 없음 — announce 삽입 실패');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonPath = path.resolve(args.json || defaultJsonPath());
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ release-notice.json 없음:', jsonPath);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const version = data.version;
  const announce = data.announce;
  if (!version || typeof version !== 'string') {
    console.error('❌ release-notice.json: version 필수(문자열)');
    process.exit(1);
  }
  if (!announce || typeof announce !== 'string') {
    console.error('❌ release-notice.json: announce 필수(문자열, HTML, \\n 허용)');
    process.exit(1);
  }

  if (!args.skipMkdocs && args.mkdocs) {
    const mkPath = path.resolve(args.mkdocs);
    const text = fs.readFileSync(mkPath, 'utf8');
    const next = replaceMkdocsAnnounce(text, announce);
    fs.writeFileSync(mkPath, next, 'utf8');
    console.log('✓ mkdocs announce:', mkPath);
  }

  if (!args.skipIncludes && args.includesDir) {
    const incDir = path.resolve(args.includesDir);
    fs.mkdirSync(incDir, { recursive: true });
    const koBody = data.landing_ko;
    const enBody = data.landing_en;
    if (koBody && typeof koBody === 'string') {
      const ko = buildLandingAdmonition(data.info_title_ko || '득팩 코어 업데이트', version, koBody);
      fs.writeFileSync(path.join(incDir, 'deukpack-release-notice.ko.md'), ko, 'utf8');
    }
    if (enBody && typeof enBody === 'string') {
      const en = buildLandingAdmonition(data.info_title_en || 'DeukPack core update', version, enBody);
      fs.writeFileSync(path.join(incDir, 'deukpack-release-notice.en.md'), en, 'utf8');
    }
    if (args.productNotices) {
      writeProductNoticeIncludes(incDir, data);
    }
    console.log('✓ includes:', incDir);
  }

  if (
    args.skipMkdocs &&
    args.skipIncludes &&
    !args.mkdocs &&
    !args.includesDir
  ) {
    console.error('❌ --mkdocs 또는 --write-includes 중 하나는 필요합니다.');
    process.exit(1);
  }

  if (!args.mkdocs && !args.includesDir && !args.skipMkdocs && !args.skipIncludes) {
    const appMk = path.join(DEUKPACK_ROOT, 'deukpack.app', 'mkdocs.yml');
    const kitsMk = path.join(DEUKPACK_ROOT, '..', 'DeukPackKits', 'mkdocs.yml');
    const appInc = path.join(DEUKPACK_ROOT, 'deukpack.app', 'docs', '_includes');
    const kitsInc = path.join(DEUKPACK_ROOT, '..', 'DeukPackKits', 'docs', '_includes');
    if (fs.existsSync(appMk)) {
      const text = fs.readFileSync(appMk, 'utf8');
      fs.writeFileSync(appMk, replaceMkdocsAnnounce(text, announce), 'utf8');
      console.log('✓ mkdocs announce:', appMk);
    }
    if (fs.existsSync(kitsMk)) {
      const text = fs.readFileSync(kitsMk, 'utf8');
      fs.writeFileSync(kitsMk, replaceMkdocsAnnounce(text, announce), 'utf8');
      console.log('✓ mkdocs announce:', kitsMk);
    }
    if (fs.existsSync(path.dirname(appInc))) {
      fs.mkdirSync(appInc, { recursive: true });
      if (data.landing_ko) {
        fs.writeFileSync(
          path.join(appInc, 'deukpack-release-notice.ko.md'),
          buildLandingAdmonition(data.info_title_ko || '득팩 코어 업데이트', version, data.landing_ko),
          'utf8'
        );
      }
      if (data.landing_en) {
        fs.writeFileSync(
          path.join(appInc, 'deukpack-release-notice.en.md'),
          buildLandingAdmonition(data.info_title_en || 'DeukPack core update', version, data.landing_en),
          'utf8'
        );
      }
      writeProductNoticeIncludes(appInc, data);
      console.log('✓ includes:', appInc);
    }
    if (fs.existsSync(path.dirname(kitsInc))) {
      fs.mkdirSync(kitsInc, { recursive: true });
      if (data.landing_ko) {
        fs.writeFileSync(
          path.join(kitsInc, 'deukpack-release-notice.ko.md'),
          buildLandingAdmonition(data.info_title_ko || '득팩 코어 업데이트', version, data.landing_ko),
          'utf8'
        );
      }
      if (data.landing_en) {
        fs.writeFileSync(
          path.join(kitsInc, 'deukpack-release-notice.en.md'),
          buildLandingAdmonition(data.info_title_en || 'DeukPack core update', version, data.landing_en),
          'utf8'
        );
      }
      console.log('✓ includes:', kitsInc);
    }
  }

  console.log('✓ release-notice', version);
}

module.exports = {
  replaceMkdocsAnnounce,
  buildLandingAdmonition,
  announceYamlBlock,
  sortedProductNotices,
  PRODUCT_NOTICE_KEYS,
  writeProductNoticeIncludes,
};

if (require.main === module) {
  main();
}
