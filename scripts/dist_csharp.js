#!/usr/bin/env node
/**
 * DeukPack C# Runtime Distribution
 *
 * Copies C# runtime source files and multi-targeted DLLs to dist/csharp/.
 *
 * Structure:
 *   dist/csharp/*.cs               (Source-level consumers)
 *   dist/csharp/<framework>/*.dll  (Binary consumers)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src', 'codegen');
const DIST_DIR = path.join(ROOT, 'dist', 'csharp');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function main() {
    ensureDir(DIST_DIR);

    let copied = 0;
    
    // 1. Copy Source Files (.cs)
    const runtimeFiles = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.cs') && !f.startsWith('__'));
    for (const file of runtimeFiles) {
        const src = path.join(SRC_DIR, file);
        const dest = path.join(DIST_DIR, file);
        fs.copyFileSync(src, dest);
        copied++;
    }

    // 2. Copy Multi-targeted Binaries (main: net6/8/9 + DeukPack.Protocol.Unity → netstandard2.0 under same bin/Release)
    const BIN_ROOT = path.join(ROOT, 'DeukPack.Protocol', 'bin', 'Release');
    if (fs.existsSync(BIN_ROOT)) {
        const frameworks = fs.readdirSync(BIN_ROOT).filter(f => fs.lstatSync(path.join(BIN_ROOT, f)).isDirectory());
        
        for (const framework of frameworks) {
            const frameworkSrcDir = path.join(BIN_ROOT, framework);
            const frameworkDestDir = path.join(DIST_DIR, framework);
            
            ensureDir(frameworkDestDir);
            
            const files = ['DeukPack.Protocol.dll', 'DeukPack.Protocol.pdb'];
            for (const file of files) {
                const src = path.join(frameworkSrcDir, file);
                const dest = path.join(frameworkDestDir, file);
                
                if (fs.existsSync(src)) {
                    fs.copyFileSync(src, dest);
                    copied++;
                    console.log(`[OK] Distributed binary (${framework}): ${file}`);
                }
            }
        }
    }

    console.log(`[OK] Distributed ${copied} C# runtime asset(s) to dist/csharp/`);
}

main();
