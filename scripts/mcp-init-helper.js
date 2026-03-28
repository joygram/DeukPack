#!/usr/bin/env node
/**
 * DeukPack MCP Init Helper
 * Sets up the environment for the generated MCP server.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function initMcp(targetDir) {
  console.log(`\n🛡️ DeukPack MCP Initialization: ${targetDir}`);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const pkgPath = path.join(targetDir, 'package.json');
  let pkg = {};
  
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } else {
    pkg = {
      name: 'deukpack-mcp-server',
      version: '1.0.0',
      description: 'Auto-generated MCP server via DeukPack',
      main: 'mcp-server.ts',
      scripts: {}
    };
  }

  // Add scripts
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['mcp:start'] = 'tsx mcp-server.ts';
  
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('✅ package.json updated.');

  // Check tsconfig
  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true
      }
    };
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    console.log('✅ tsconfig.json created.');
  }

  // Install dependencies
  console.log('📦 Installing dependencies (@modelcontextprotocol/sdk, zod, tsx)...');
  try {
    execSync('npm install @modelcontextprotocol/sdk zod tsx', { cwd: targetDir, stdio: 'inherit' });
    console.log('\n🚀 MCP Ready! Run: npm run mcp:start');
  } catch (err) {
    console.error('❌ Failed to install dependencies. Please run manually:');
    console.log(`   cd ${targetDir} && npm install @modelcontextprotocol/sdk zod tsx`);
  }
}

const args = process.argv.slice(2);
const target = args[0] || process.cwd();
initMcp(path.resolve(target));
