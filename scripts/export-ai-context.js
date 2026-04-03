#!/usr/bin/env node
/**
 * Export DeukPack IDL as AI Context (Markdown/JSON)
 * Use this to provide detailed semantic knowledge to AI agents (Cursor, Anthropic, etc.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DeukPackCodec, AiContextGenerator } = require('../dist/index');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const p = process.argv.find((a) => a.startsWith(`${name}=`));
  if (p) return p.slice(name.length + 1);
  return def;
}

async function main() {
  const deukRoot = path.resolve(__dirname, '..');
  const defineRoot = path.resolve(
    arg('--define-root', path.join(deukRoot, '..', 'project_dp', 'idls'))
  );
  const outDir = path.resolve(arg('--out-dir', path.join(deukRoot, 'docs', 'ai')));
  const entryRel = arg('--entry', path.join('deuk_table', 'deuk_table_entry.deuk'));
  const title = arg('--title', 'DeukPack AI Semantic Context');
  
  console.log(`[AI-Ready] Exporting AI context from: ${defineRoot}`);
  console.log(`[AI-Ready] Entry point: ${entryRel}`);

  if (!fs.existsSync(defineRoot)) {
    console.error(`[Error] IDL root not found: ${defineRoot}`);
    process.exit(1);
  }

  const entry = path.join(defineRoot, entryRel);
  if (!fs.existsSync(entry)) {
    console.warn(`[Warning] Entry file not found: ${entry}. Falling back to directory scan...`);
    // Note: In a real project, we'd walk the tree if full-tree is requested.
  }

  try {
    const engine = new DeukPackCodec();
    // Parse the entire tree via entry point
    const ast = await engine.parseFileWithIncludes(entry, {
      includePaths: [defineRoot],
      allowMultiNamespace: true,
    });

    const generator = new AiContextGenerator();
    
    // Generate Markdown
    const mdContent = generator.generate(ast, { 
      format: 'markdown', 
      title,
      version: require('../package.json').version
    });
    
    // Generate JSON
    const jsonContent = generator.generate(ast, { 
      format: 'json', 
      title,
      version: require('../package.json').version
    });

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const mdPath = path.join(outDir, 'AI_CONTEXT.md');
    const jsonPath = path.join(outDir, 'AI_CONTEXT.json');

    fs.writeFileSync(mdPath, mdContent, 'utf8');
    fs.writeFileSync(jsonPath, jsonContent, 'utf8');

    console.log(`[Success] AI Context exported to:`);
    console.log(`  - Markdown: ${mdPath}`);
    console.log(`  - JSON: ${jsonPath}`);
    
    console.log(`\n[Tip] Now you can point your AI Agent to ${mdPath} to improve its understanding of your system.`);

  } catch (e) {
    console.error(`[Error] Failed to export AI context: ${e.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
