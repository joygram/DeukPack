#!/usr/bin/env node

/**
 * DeukPack Builder
 * 100x faster than Apache Thrift with multi-language support
 * Supports single-file mode and --pipeline <config.json> for multi-job + copy steps.
 */

const { DeukPackEngine } = require('../dist/index');
const path = require('path');
const fs = require('fs').promises;

async function main() {
    const args = process.argv.slice(2);

    // Pipeline mode: --pipeline <config.json>
    if (args[0] === '--pipeline' && args[1]) {
        try {
            await runPipeline(path.resolve(args[1]));
        } catch (error) {
            console.error('❌ Pipeline failed:', error.message);
            process.exit(1);
        }
        return;
    }

    if (args.length < 2) {
        console.error('Usage: node build_deukpack.js <thrift_file> <output_dir> [options]');
        console.error('       node build_deukpack.js --pipeline <pipeline_config.json>');
        console.error('Options:');
        console.error('  -I, -i <path>   Include path (individual)');
        console.error('  -r <path>       Include path + direct subdirs (recursive)');
        console.error('  --define-root <name>  IDL root folder (default: _deuk_define, legacy: _thrift)');
        console.error('  --csharp    Generate C# code (and DeukDefine.csproj by default)');
        console.error('  --csharp-project-name <name>  C# project/assembly name (default: DeukDefine)');
        console.error('  --no-csharp-csproj    Do not emit .csproj when generating C#');
        console.error('  --cpp       Generate C++ code');
        console.error('  --js        Generate JavaScript code (for meta editor: Thrift JS <-> Webix/Thrift JSON/Excel)');
        console.error('  --protocol <protocol>  Serialization protocol (binary|compact|json)');
        console.error('  --endianness <endian>  Endianness (little|big)');
        console.error('  --convert-to-deuk [subdir]  Emit .deuk from parsed Thrift (subdir default: deuk). Legacy→table migration.');
        console.error('  --ef    Enable Entity Framework support ( [Table]/[Key]/[Column] + DeukPackDbContext.g.cs ).');
        process.exit(1);
    }

    const thriftFile = args[0];
    const outputDir = args[1];
    const { options, includePaths: extraIncludePaths, includePathsRecursive } = parseOptions(args.slice(2));

    const baseDir = path.dirname(path.resolve(thriftFile));
    const expandedRecursive = await expandRecursiveIncludePaths(includePathsRecursive.map(p => path.resolve(p)));
    const includePaths = [baseDir, ...extraIncludePaths, ...expandedRecursive];
    const parseOpts = {
        includePaths,
        defineRoot: options.defineRoot
    };

    console.log(`🚀 DeukPack Builder v1.0.0`);
    console.log(`📁 Input: ${thriftFile}`);
    console.log(`📁 Output: ${outputDir}`);
    console.log(`⚙️  Options:`, options);

    try {
        await runOneBuild(thriftFile, outputDir, options, parseOpts);
        console.log('\n🎉 Build completed successfully!');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

/**
 * Run a single thrift build: parse + generate. Used by both single-file and pipeline mode.
 * @param {string} thriftFile - Path to root thrift file
 * @param {string} outputDir - Directory for generated output (csharp/, cpp/, etc.)
 * @param {object} options - { csharp, cpp, js, json, defineRoot }
 * @param {object} parseOpts - { includePaths, defineRoot } for parseFileWithIncludes
 */
async function runOneBuild(thriftFile, outputDir, options, parseOpts) {
    await fs.mkdir(outputDir, { recursive: true });
    const engine = new DeukPackEngine();
    const defineVersionFile = path.join(path.dirname(path.resolve(thriftFile)), 'define_version.txt');

    console.log('📖 Parsing Thrift files...');
    const startTime = Date.now();
    const ast = await engine.parseFileWithIncludes(thriftFile, parseOpts);
    const parseTime = Date.now() - startTime;
    console.log(`Parsed ${ast.filesProcessed || 1} files in ${parseTime}ms`);
    console.log(`✅ Parsed in ${parseTime}ms`);

    const generationPromises = [];
    if (options.csharp) generationPromises.push(generateCSharp(engine, ast, outputDir, { ...options, defineVersionFile }));
    if (options.cpp) generationPromises.push(generateCpp(engine, ast, outputDir));
    if (options.js) generationPromises.push(generateJavaScript(engine, ast, outputDir));
    await Promise.all(generationPromises);

    if (options.convertToDeuk) {
        const legacyMigrator = path.join(__dirname, 'internal', 'legacy-migration', 'convert_thrift_to_deuk.js');
        let run;
        try {
            ({ run } = require(legacyMigrator));
        } catch (e) {
            console.error('❌ --convert-to-deuk: internal legacy migration scripts are not available.');
            console.error('   (OSS / npm package excludes project-specific Thrift→.deuk rules.)');
            console.error('   Use the full DeukPack tree with scripts/internal/legacy-migration/, or migrate by other means.');
            process.exit(1);
        }
        await run(ast, thriftFile, outputDir, options.convertToDeukOutputDir, { emitPerFile: options.emitPerFile });
    }

    const metrics = engine.getPerformanceMetrics();
    console.log('\n📊 Performance Metrics:');
    console.log(`   Parse Time: ${metrics.parseTime}ms`);
    console.log(`   Generate Time: ${metrics.generateTime}ms`);
    console.log(`   Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Files Processed: ${metrics.fileCount}`);
}

/**
 * Expand directories to [dir, ...direct subdirs]. Each entry in dirPaths is an absolute path.
 * Used for recursive include: one path becomes root + all first-level subdirs.
 */
async function expandRecursiveIncludePaths(dirPaths) {
    const result = [];
    for (const dir of dirPaths) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            result.push(dir);
            for (const e of entries) {
                if (e.isDirectory()) result.push(path.join(dir, e.name));
            }
        } catch (e) {
            console.warn(`   ⚠️  Skip recursive include (missing or not readable): ${dir}`);
        }
    }
    return result;
}

/**
 * Resolve includePaths from config: entries can be string (individual) or { path, recursive: true }.
 * All paths resolved relative to configDir. Returns flat array of absolute paths.
 */
async function resolveIncludePathsFromConfig(includePaths, configDir) {
    if (!Array.isArray(includePaths) || includePaths.length === 0) return [];
    const resolved = [];
    const recursiveDirs = [];
    for (const entry of includePaths) {
        if (typeof entry === 'string') {
            resolved.push(path.resolve(configDir, entry));
        } else if (entry && typeof entry === 'object' && entry.path != null && entry.recursive) {
            recursiveDirs.push(path.resolve(configDir, entry.path));
        }
    }
    const expanded = await expandRecursiveIncludePaths(recursiveDirs);
    return [...resolved, ...expanded];
}

/**
 * Pipeline config (JSON): { defineRoot?, includePaths?, jobs: [ { name?, thriftFile, outputDir, includePaths?, csharp?, cpp?, js?, json?, copy?: [ { from, to } ] } ] }
 * includePaths: string[] (individual) or mixed: string | { path: string, recursive: true } (recursive = path + direct subdirs).
 * Paths in config are resolved relative to the config file directory.
 */
async function runPipeline(configPath) {
    const configDir = path.dirname(path.resolve(configPath));
    let config;
    try {
        const raw = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(raw);
    } catch (e) {
        throw new Error(`Failed to load pipeline config: ${e.message}`);
    }
    const jobs = config.jobs;
    if (!Array.isArray(jobs) || jobs.length === 0) {
        throw new Error('Pipeline config must have a non-empty "jobs" array');
    }

    const defineRoot = config.defineRoot;
    const globalIncludePaths = await resolveIncludePathsFromConfig(config.includePaths || [], configDir);

    console.log(`🚀 DeukPack Pipeline v1.0.0`);
    console.log(`📄 Config: ${configPath}`);
    console.log(`   Jobs: ${jobs.length}`);

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const name = job.name || job.thriftFile || `job${i + 1}`;
        const thriftFile = path.resolve(configDir, job.thriftFile);
        const outputDir = path.resolve(configDir, job.outputDir);
        const jobIncludePaths = await resolveIncludePathsFromConfig(job.includePaths || [], configDir);
        const baseDir = path.dirname(thriftFile);
        const includePaths = [baseDir, ...globalIncludePaths, ...jobIncludePaths];
        const parseOpts = { includePaths, defineRoot };
        const options = {
            csharp: !!job.csharp,
            cpp: !!job.cpp,
            js: !!job.js,
            json: !!job.json,
            ef: !!job.ef,
            defineRoot,
            convertToDeuk: !!job.convertToDeuk,
            convertToDeukOutputDir: job.convertToDeukOutputDir || 'deuk',
            csharpProjectName: job.csharpProjectName || 'DeukDefine',
            emitCsproj: job.emitCsproj !== false
        };

        console.log(`\n--- Job: ${name} ---`);
        await runOneBuild(thriftFile, outputDir, options, parseOpts);

        const copyList = job.copy || [];
        for (const rule of copyList) {
            const from = path.resolve(configDir, rule.from);
            const to = path.resolve(configDir, rule.to);
            console.log(`   📋 Copy: ${rule.from} → ${rule.to}`);
            await copyDir(from, to);
        }
    }

    console.log('\n🎉 Pipeline completed successfully!');
}

const WINDOWS_RESERVED = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

async function copyDir(fromDir, toDir) {
    try {
        await fs.access(fromDir);
    } catch {
        console.warn(`   ⚠️  Skip copy (source missing): ${fromDir}`);
        return;
    }
    await fs.mkdir(toDir, { recursive: true });
    const entries = await fs.readdir(fromDir, { withFileTypes: true });
    for (const entry of entries) {
        const name = entry.name;
        if (name === '' || name === 'nul' || WINDOWS_RESERVED.includes(name.toUpperCase())) {
            console.warn(`   ⚠️  Skipping reserved filename: ${name}`);
            continue;
        }
        if (name.endsWith('.Thrift.cs') || /\.Thrift\.cs$/i.test(name)) {
            console.warn(`   ⚠️  Skipping duplicate: ${name}`);
            continue;
        }
        const src = path.join(fromDir, name);
        const dest = path.join(toDir, name);
        if (entry.isDirectory()) {
            await copyDir(src, dest);
        } else {
            if (src.includes('\\nul\\') || src.endsWith('\\nul') || dest.includes('\\nul\\') || dest.endsWith('\\nul')) {
                console.warn(`   ⚠️  Skipping invalid path: ${name}`);
                continue;
            }
            await fs.copyFile(src, dest);
        }
    }
}

function parseOptions(args) {
    const options = {
        csharp: false,
        cpp: false,
        js: false,
        json: false,
        protocol: 'binary',
        endianness: 'little',
        defineRoot: undefined,  // --define-root _deuk_define | _thrift
        convertToDeuk: false,
        convertToDeukOutputDir: 'deuk',  // --convert-to-deuk [subdir]
        emitPerFile: false,  // --emit-per-file  AST 내 각 sourceFile별 .deuk 추가 출력 (server_msg_db 등)
        ef: false,  // --ef  Entity Framework support (meta table entities + DbContext)
        csharpProjectName: 'DeukDefine',  // --csharp-project-name <name>  emitted .csproj AssemblyName/filename
        emitCsproj: true  // set false with --no-csharp-csproj to skip generating DeukDefine.csproj
    };

    const includePaths = [];
    const includePathsRecursive = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--convert-to-deuk':
                options.convertToDeuk = true;
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options.convertToDeukOutputDir = args[++i];
                }
                break;
            case '--emit-per-file':
                options.emitPerFile = true;
                break;
            case '-I':
            case '-i':
                if (i + 1 < args.length) {
                    includePaths.push(args[++i]);
                }
                break;
            case '-r':
            case '--include-recursive':
                if (i + 1 < args.length) {
                    includePathsRecursive.push(args[++i]);
                }
                break;
            case '--define-root':
                if (i + 1 < args.length) {
                    options.defineRoot = args[++i];
                }
                break;
            case '--csharp':
                options.csharp = true;
                break;
            case '--cpp':
                options.cpp = true;
                break;
            case '--js':
                options.js = true;
                break;
            case '--ef':
                options.ef = true;
                break;
            case '--csharp-project-name':
                if (i + 1 < args.length) {
                    options.csharpProjectName = args[++i];
                }
                break;
            case '--no-csharp-csproj':
                options.emitCsproj = false;
                break;
            case '--protocol':
                if (i + 1 < args.length) {
                    options.protocol = args[++i];
                }
                break;
            case '--endianness':
                if (i + 1 < args.length) {
                    options.endianness = args[++i];
                }
                break;
        }
    }

    return { options, includePaths, includePathsRecursive };
}

/**
 * Returns portable DeukDefine.csproj content (project-agnostic).
 * Caller can override DeukPackProtocolProject in Directory.Build.props or edit the .csproj.
 * @param {string} assemblyName - e.g. 'DeukDefine'
 */
function getDefaultCsprojContent(assemblyName = 'DeukDefine') {
    return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by DeukPack. Add ProjectReference to DeukPack.Protocol or set DeukPackProtocolProject in Directory.Build.props. -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>gplat</RootNamespace>
    <AssemblyName>${assemblyName}</AssemblyName>
    <OutputType>Library</OutputType>
    <TargetFrameworks>netstandard2.0;net8.0</TargetFrameworks>
    <Nullable>disable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup Condition="'$(DeukPackProtocolProject)' != ''">
    <ProjectReference Include="$(DeukPackProtocolProject)" />
  </ItemGroup>
  <!-- Fallback: DeukPack at ../../../DeukPack (e.g. output is libDeukDefine/csharp, repo has DeukPack). -->
  <ItemGroup Condition="'$(DeukPackProtocolProject)' == '' and Exists('$(MSBuildThisFileDirectory)..\\..\\..\\DeukPack\\DeukPack.Protocol\\DeukPack.Protocol.csproj')">
    <ProjectReference Include="$(MSBuildThisFileDirectory)..\\..\\..\\DeukPack\\DeukPack.Protocol\\DeukPack.Protocol.csproj" />
  </ItemGroup>
</Project>
`;
}

async function generateCSharp(engine, ast, outputDir, options = {}) {
    console.log('🔧 Generating C# code...');
    const startTime = Date.now();

    const csharpDir = path.join(outputDir, 'csharp');
    await fs.mkdir(csharpDir, { recursive: true });

    // Use the actual C# generator
    const { CSharpGenerator } = require('../dist/codegen/CSharpGenerator');
    const generator = new CSharpGenerator();

    const genOptions = { efSupport: options.ef === true, defineVersionFile: options.defineVersionFile };
    const csharpFiles = await generator.generate(ast, genOptions);

    // Write each file separately
    for (const [filename, content] of Object.entries(csharpFiles)) {
        // Windows 예약어 필터링 (nul 등 방지)
        if (!filename || filename === 'nul.cs' || filename.startsWith('nul')) {
            console.warn(`   ⚠️  Skipping invalid filename: ${filename}`);
            continue;
        }

        const filePath = path.join(csharpDir, filename);
        // 경로에 nul이 포함되어 있으면 건너뛰기
        if (filePath.includes('\\nul\\') || filePath.endsWith('\\nul')) {
            console.warn(`   ⚠️  Skipping invalid path: ${filePath}`);
            continue;
        }

        await fs.writeFile(filePath, content, 'utf8');
        console.log(`   📄 Generated: ${filename}`);
    }

    // Emit DeukDefine.csproj (or custom name) so the C# output is a standalone project, not tied to a specific repo.
    if (options.emitCsproj !== false) {
        const projectName = options.csharpProjectName || 'DeukDefine';
        const csprojName = projectName + '.csproj';
        const csprojPath = path.join(csharpDir, csprojName);
        await fs.writeFile(csprojPath, getDefaultCsprojContent(projectName), 'utf8');
        console.log(`   📄 Generated: ${csprojName}`);
    }

    const generateTime = Date.now() - startTime;
    console.log(`✅ C# generated ${Object.keys(csharpFiles).length} files in ${generateTime}ms`);
}

async function generateCpp(engine, ast, outputDir) {
    console.log('🔧 Generating C++ code...');
    const startTime = Date.now();

    const cppDir = path.join(outputDir, 'cpp');
    await fs.mkdir(cppDir, { recursive: true });

    const { CppGenerator } = require('../dist/codegen/CppGenerator');
    const generator = new CppGenerator();
    const cppFiles = await generator.generate(ast, {});

    for (const [filename, content] of Object.entries(cppFiles)) {
        if (!filename || filename === 'nul.h' || filename === 'nul.cpp' || filename.startsWith('nul')) {
            console.warn(`   ⚠️  Skipping invalid filename: ${filename}`);
            continue;
        }
        const filePath = path.join(cppDir, filename);
        if (filePath.includes('\\nul\\') || filePath.endsWith('\\nul')) {
            console.warn(`   ⚠️  Skipping invalid path: ${filePath}`);
            continue;
        }
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`   📄 Generated: ${filename}`);
    }

    const generateTime = Date.now() - startTime;
    console.log(`✅ C++ generated ${Object.keys(cppFiles).length} files in ${generateTime}ms`);
}

/**
 * 레거시 타입명 → 득팩 표준 typeName (엑셀 스키마 뷰/비교에서 동일하게 표기).
 */
function toDeukPackStandardTypeName(t) {
    if (!t || typeof t !== 'string') return t;
    const k = t.trim().toLowerCase();
    const map = { i16: 'int16', i32: 'int32', i64: 'int64', i8: 'int8', list: 'list', lst: 'list', set: 'set', map: 'map', struct: 'record', rec: 'record' };
    return map[k] !== undefined ? map[k] : t;
}

/**
 * Get schema type string for a Thrift field type. typeName은 득팩 표준으로 출력(엑셀 스키마 뷰/비교용).
 * @param {any} fieldType - string e.g. 'i32' or object e.g. { type: 'list', elementType: 'i32' }
 * @returns {{ type: string, typeName: string }}
 */
function getSchemaTypeInfo(fieldType) {
    if (typeof fieldType === 'string') {
        const typeMap = {
            bool: 'Bool', byte: 'Byte', i8: 'Byte', i16: 'I16', i32: 'I32', i64: 'I64',
            double: 'Double', string: 'String', binary: 'Binary'
        };
        const typeName = toDeukPackStandardTypeName(fieldType);
        return { type: typeMap[fieldType] || 'Struct', typeName };
    }
    if (fieldType && typeof fieldType === 'object') {
        if (fieldType.type === 'list') {
            const elem = getSchemaTypeInfo(fieldType.elementType);
            return { type: 'List', typeName: elem.typeName };
        }
        if (fieldType.type === 'set') {
            const elem = getSchemaTypeInfo(fieldType.elementType);
            return { type: 'Set', typeName: elem.typeName };
        }
        if (fieldType.type === 'map') {
            const k = getSchemaTypeInfo(fieldType.keyType);
            const v = getSchemaTypeInfo(fieldType.valueType);
            return { type: 'Map', typeName: `map<${k.typeName},${v.typeName}>` };
        }
    }
    const raw = typeof fieldType === 'string' ? fieldType : 'struct';
    return { type: 'Struct', typeName: toDeukPackStandardTypeName(raw) };
}

async function generateJavaScript(engine, ast, outputDir) {
    // Meta editor loads this JS and uses it for Thrift JS <-> Webix JSON, Thrift JSON.
    // Generated Thrift objects include getSchema() (same idea as C# GetSchema()) so schema is self-contained.
    console.log('🔧 Generating JavaScript code (meta editor runtime)...');
    const startTime = Date.now();

    const jsDir = path.join(outputDir, 'javascript');
    await fs.mkdir(jsDir, { recursive: true });

    const lines = [];
    lines.push('// Generated by DeukPack v1.0.0');
    lines.push('// ' + new Date().toISOString());
    lines.push('// Thrift JS objects with embedded schema (getSchema()) for meta editor.');
    lines.push('// Protocol helpers: toJson/fromJson (Thrift JSON), toBinary/fromBinary (binary).');
    lines.push('');

    lines.push('// --- Protocol runtime (Thrift JSON shape: field-id keys, { i32|str|lst|map|rec|... } wrappers) ---');
    lines.push('function _wrapThriftJson(type, typeName, val, schemas) {');
    lines.push('  if (val === null || val === undefined) return null;');
    lines.push('  switch (type) {');
    lines.push('    case "Bool": return { tf: !!val };');
    lines.push('    case "Byte": case "I16": case "I32": return { i32: Number(val) };');
    lines.push('    case "I64": return { i64: Number(val) };');
    lines.push('    case "Double": return { dbl: Number(val) };');
    lines.push('    case "String": return { str: String(val) };');
    lines.push('    case "Binary":');
    lines.push('      if (typeof Buffer !== "undefined") return { str: Buffer.from(val).toString("base64") };');
    lines.push('      var arr = val && val.length != null ? val : []; var s = ""; for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i] & 255); return { str: (typeof btoa !== "undefined" ? btoa(s) : "") };');
    lines.push('    case "List": case "Set":');
    lines.push('      var elem = (typeName.match(/^(?:list|set)<(.+)>$/) || [])[1];');
    lines.push('      return { lst: (val || []).map(function(e) { return _wrapThriftJson(_elemType(elem), elem, e, schemas); }) };');
    lines.push('    case "Map":');
    lines.push('      var m = (typeName.match(/^map<([^,]+),(.+)>$/) || []);');
    lines.push('      var out = {};');
    lines.push('      for (var k in val) if (Object.prototype.hasOwnProperty.call(val, k)) out[String(k)] = _wrapThriftJson(_elemType(m[2]), m[2], val[k], schemas);');
    lines.push('      return { map: out };');
    lines.push('    default:');
    lines.push('      var s = schemas && schemas[typeName];');
    lines.push('      return s ? { rec: _toThriftJson(s, val, schemas) } : { str: String(val) };');
    lines.push('  }');
    lines.push('}');
    lines.push('function _elemType(tn) { if (!tn) return "String"; var m = tn.match(/^(?:list|set)<(.+)>$/); return m ? _elemType(m[1]) : (tn === "i32" || tn === "i64" ? "I32" : (tn === "double" ? "Double" : (tn === "string" ? "String" : "Struct"))); }');
    lines.push('function _toThriftJson(schema, obj, schemas) {');
    lines.push('  if (!schema || schema.type !== "Struct" || !schema.fields) return obj;');
    lines.push('  var out = {};');
    lines.push('  for (var id in schema.fields) { var f = schema.fields[id]; var v = obj && obj[f.name]; if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue; if (v !== undefined) out[String(id)] = _wrapThriftJson(f.type, f.typeName, v, schemas); }');
    lines.push('  return out;');
    lines.push('}');
    lines.push('function _unwrapThriftJson(type, typeName, jsonVal, schemas) {');
    lines.push('  if (jsonVal === null || jsonVal === undefined) return null;');
    lines.push('  if (type !== "Struct" && typeof jsonVal === "object" && !Array.isArray(jsonVal)) {');
    lines.push('    if (type === "Binary" && jsonVal.str) { var b64 = jsonVal.str; if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64")); var bin = typeof atob !== "undefined" ? atob(b64) : ""; var arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; }');
    lines.push('    if (jsonVal.str !== undefined) return jsonVal.str;');
    lines.push('    if (jsonVal.i32 !== undefined) return jsonVal.i32;');
    lines.push('    if (jsonVal.i64 !== undefined) return Number(jsonVal.i64);');
    lines.push('    if (jsonVal.dbl !== undefined) return jsonVal.dbl;');
    lines.push('    if (jsonVal.tf !== undefined) return jsonVal.tf;');
    lines.push('    if (jsonVal.lst !== undefined) { var elem = (typeName.match(/^(?:list|set)<(.+)>$/) || [])[1]; return jsonVal.lst.map(function(e) { return _unwrapThriftJson(_elemType(elem), elem, e, schemas); }); }');
    lines.push('    if (jsonVal.map !== undefined) { var m = (typeName.match(/^map<([^,]+),(.+)>$/) || []); var o = {}; for (var k in jsonVal.map) o[k] = _unwrapThriftJson(_elemType(m[2]), m[2], jsonVal.map[k], schemas); return o; }');
    lines.push('    if (jsonVal.rec !== undefined) { var s = schemas && schemas[typeName]; return s ? _fromThriftJson(s, jsonVal.rec, schemas) : jsonVal.rec; }');
    lines.push('  }');
    lines.push('  return jsonVal;');
    lines.push('}');
    lines.push('function _fromThriftJson(schema, jsonObj, schemas) {');
    lines.push('  if (!schema || schema.type !== "Struct" || !schema.fields) return jsonObj || {};');
    lines.push('  var out = {};');
    lines.push('  for (var id in schema.fields) { var f = schema.fields[id]; var w = jsonObj && jsonObj[String(id)]; if (w !== undefined) out[f.name] = _unwrapThriftJson(f.type, f.typeName, w, schemas); }');
    lines.push('  return out;');
    lines.push('}');
    lines.push('');


    // Enums: value map + getSchema() with docComment, annotations, valueComments (full recoverable)
    for (const enumDef of ast.enums || []) {
        const safeName = enumDef.name.replace(/\./g, '_');
        const schemaObj = {
            name: enumDef.name,
            type: 'Enum',
            values: enumDef.values,
            docComment: enumDef.docComment != null ? enumDef.docComment : undefined,
            valueComments: enumDef.valueComments && Object.keys(enumDef.valueComments || {}).length ? enumDef.valueComments : undefined,
            annotations: enumDef.annotations && Object.keys(enumDef.annotations || {}).length ? enumDef.annotations : undefined
        };
        lines.push('const _schema_' + safeName + ' = ' + JSON.stringify(schemaObj) + ';');
        lines.push(`const ${safeName} = {`);
        lines.push('  values: _schema_' + safeName + '.values,');
        lines.push('  getSchema() { return _schema_' + safeName + '; }');
        lines.push('};');
        lines.push('');
    }

    // Structs: schema constant + getSchema() with docComment, annotations, full defaultValue (mirrors C# GetSchema())
    for (const struct of ast.structs || []) {
        const safeName = struct.name.replace(/\./g, '_');
        const fieldsObj = {};
        for (const field of struct.fields || []) {
            const ti = getSchemaTypeInfo(field.type);
            const f = {
                id: field.id,
                name: field.name,
                type: ti.type,
                typeName: ti.typeName,
                required: !!field.required,
                defaultValue: field.defaultValue !== undefined ? field.defaultValue : null,
                docComment: field.docComment != null ? field.docComment : undefined,
                annotations: field.annotations && Object.keys(field.annotations).length ? field.annotations : undefined
            };
            fieldsObj[field.id] = f;
        }
        const schemaObj = {
            name: struct.name,
            type: 'Struct',
            fields: fieldsObj,
            docComment: struct.docComment != null ? struct.docComment : undefined,
            annotations: struct.annotations && Object.keys(struct.annotations || {}).length ? struct.annotations : undefined
        };
        const schemaJson = JSON.stringify(schemaObj);
        lines.push(`const _schema_${safeName} = ${schemaJson};`);
        lines.push(`const ${safeName} = {`);
        lines.push('  getSchema() { return _schema_' + safeName + '; },');
        lines.push('  create() { return {}; },');
        lines.push('  toJson(obj) { return JSON.stringify(_toThriftJson(_schema_' + safeName + ', obj, _schemas)); },');
        lines.push('  fromJson(str) { return _fromThriftJson(_schema_' + safeName + ', JSON.parse(str || "{}"), _schemas); },');
        lines.push('  toBinary(obj) { throw new Error("toBinary: use C#/TS runtime or DeukPack binary protocol"); },');
        lines.push('  fromBinary(buf) { throw new Error("fromBinary: use C#/TS runtime or DeukPack binary protocol"); },');
        lines.push('};');
        lines.push('');
    }

    lines.push('var _schemas = {};');
    for (const struct of ast.structs || []) {
        const safeName = struct.name.replace(/\./g, '_');
        lines.push('_schemas["' + struct.name.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
    }
    lines.push('var _enums = {};');
    for (const enumDef of ast.enums || []) {
        const safeName = enumDef.name.replace(/\./g, '_');
        lines.push('_enums["' + enumDef.name.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
    }
    lines.push('');

    // Export for Node/UMD (meta editor can assign to window or use module)
    lines.push('if (typeof module !== "undefined" && module.exports) {');
    const allNames = []
        .concat((ast.enums || []).map(e => e.name.replace(/\./g, '_')))
        .concat((ast.structs || []).map(s => s.name.replace(/\./g, '_')));
    allNames.forEach(n => { lines.push('  module.exports.' + n + ' = ' + n + ';'); });
    lines.push('}');
    lines.push('');

    const jsContent = lines.join('\n');
    await fs.writeFile(path.join(jsDir, 'generated.js'), jsContent);

    const generateTime = Date.now() - startTime;
    console.log(`✅ JavaScript generated (${ast.structs.length} structs, ${ast.enums.length} enums) in ${generateTime}ms`);
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, runOneBuild, runPipeline, copyDir };
