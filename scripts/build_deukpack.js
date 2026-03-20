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
        console.error('  --define-root <name>  IDL root folder (default: idls, legacy: _thrift)');
        console.error('  --csharp    Generate C# code (and DeukDefine.csproj by default)');
        console.error('  --csharp-project-name <name>  C# project/assembly name (default: DeukDefine)');
        console.error('  --no-csharp-csproj    Do not emit .csproj when generating C#');
        console.error('  --cpp       Generate C++ code');
        console.error('  --ts        Generate TypeScript (1st-stage types; JS via app build or tsc). See docs/DEUKPACK_JS_BUILD_PIPELINE.md');
        console.error('  --js        Generate JavaScript (Path B: direct JS for Node/tools). App bundle: use TS output + app build.');
        console.error('  --protocol <protocol>  Serialization protocol (binary|compact|json)');
        console.error('  --endianness <endian>  Endianness (little|big)');
        console.error('  --convert-to-deuk [subdir]  Emit .deuk from parsed .thrift (subdir default: deuk). Legacy→table migration.');
        console.error('  --ef    Enable Entity Framework support ( [Table]/[Key]/[Column] + DeukPackDbContext.g.cs ).');
        console.error('  --wire-profile <name>  Repeat or comma-separated: emit C# (and --js) subset types per profile (annotation wireProfiles on fields).');
        console.error('  --import-openapi <file>  Merge OpenAPI 3.x components/schemas into AST.');
        console.error('  --openapi <file>  Emit OpenAPI 3.x from AST.');
        console.error('  --import-csv/--import-psv/--import-json/--import-excel <file>  Merge schema (first row/keys) into AST.');
        console.error('  --csv/--psv/--json/--excel <file>  Emit schema from AST (first struct). Round-trip: format → deuk → format.');
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
 * @param {object} options - { csharp, cpp, ts, js, json, defineRoot, wireProfiles }
 * @param {object} parseOpts - { includePaths, defineRoot } for parseFileWithIncludes
 */
function loadOpenApiSpec(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const isYaml = ext === '.yaml' || ext === '.yml';
    if (isYaml) {
        try {
            const yaml = require('js-yaml');
            const content = require('fs').readFileSync(filePath, 'utf8');
            return yaml.load(content);
        } catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                throw new Error('YAML support requires js-yaml. Run: npm install js-yaml');
            }
            throw e;
        }
    }
    const content = require('fs').readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

function isOpenApiInput(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.yaml' || ext === '.yml' || ext === '.json';
}

function getSchemaInputKind(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') return 'csv';
    if (ext === '.psv') return 'psv';
    if (ext === '.xlsx') return 'excel';
    if (ext === '.json') return 'json';
    return null;
}

async function runOneBuild(thriftFile, outputDir, options, parseOpts) {
    await fs.mkdir(outputDir, { recursive: true });
    const engine = new DeukPackEngine();
    const defineVersionFile = path.join(path.dirname(path.resolve(thriftFile)), 'define_version.txt');

    console.log('📖 Parsing IDL files...');
    const startTime = Date.now();
    let ast;
    const schemaKind = getSchemaInputKind(thriftFile);
    if (schemaKind === 'csv') {
        const { parseDelimitedFileToAst } = require('../dist/schema-io/DelimitedSchema');
        ast = parseDelimitedFileToAst(path.resolve(thriftFile), ',', thriftFile);
        console.log('   (CSV input: first row → AST)');
    } else if (schemaKind === 'psv') {
        const { parseDelimitedFileToAst } = require('../dist/schema-io/DelimitedSchema');
        ast = parseDelimitedFileToAst(path.resolve(thriftFile), '|', thriftFile);
        console.log('   (PSV input: first row → AST)');
    } else if (schemaKind === 'excel') {
        const { parseExcelFileToAst } = require('../dist/schema-io/ExcelSchema');
        ast = parseExcelFileToAst(path.resolve(thriftFile), thriftFile);
        console.log('   (Excel input: first row → AST)');
    } else if (schemaKind === 'json') {
        const raw = require('fs').readFileSync(path.resolve(thriftFile), 'utf8');
        const spec = JSON.parse(raw);
        if (spec && spec.openapi && spec.components) {
            const { parseOpenApiToAst } = require('../dist/openapi/OpenApiParser');
            ast = parseOpenApiToAst(spec, path.basename(thriftFile));
            console.log('   (OpenAPI input: components/schemas → AST)');
        } else {
            const { parseJsonFileToAst } = require('../dist/schema-io/JsonSchema');
            ast = parseJsonFileToAst(path.resolve(thriftFile), thriftFile);
            console.log('   (JSON input: keys → AST)');
        }
    } else if (isOpenApiInput(thriftFile)) {
        const spec = loadOpenApiSpec(path.resolve(thriftFile));
        if (spec && spec.openapi && spec.components) {
            const { parseOpenApiToAst } = require('../dist/openapi/OpenApiParser');
            ast = parseOpenApiToAst(spec, path.basename(thriftFile));
            console.log('   (OpenAPI input: components/schemas → AST)');
        } else {
            throw new Error('File does not look like OpenAPI 3.x (need openapi and components).');
        }
    } else {
        ast = await engine.parseFileWithIncludes(thriftFile, parseOpts);
    }
    if (options.importOpenApi) {
        const spec = loadOpenApiSpec(path.resolve(options.importOpenApi));
        const { importOpenApiSchemas } = require('../dist/openapi/OpenApiParser');
        const { structs, enums, namespace } = importOpenApiSchemas(spec, path.basename(options.importOpenApi));
        ast.structs = ast.structs || [];
        ast.enums = ast.enums || [];
        ast.structs.push(...structs);
        ast.enums.push(...enums);
        if (!ast.namespaces.some((n) => n.name === namespace)) {
            ast.namespaces = ast.namespaces || [];
            ast.namespaces.push({ language: '*', name: namespace, sourceFile: options.importOpenApi });
        }
        console.log(`   Merged OpenAPI: ${structs.length} structs, ${enums.length} enums`);
    }
    function mergeSchemaStructs(structs, nsLabel) {
        if (!structs.length) return;
        ast.structs = ast.structs || [];
        ast.structs.push(...structs);
        const ns = ast.namespaces?.find((n) => n.name === 'Imported') || { language: '*', name: 'Imported', sourceFile: '' };
        if (!ast.namespaces.some((n) => n.name === 'Imported')) {
            ast.namespaces = ast.namespaces || [];
            ast.namespaces.push(ns);
        }
        console.log(`   Merged ${nsLabel}: ${structs.length} struct(s)`);
    }
    if (options.importCsv) {
        const { parseDelimitedFileToAst } = require('../dist/schema-io/DelimitedSchema');
        const imported = parseDelimitedFileToAst(path.resolve(options.importCsv), ',', options.importCsv);
        mergeSchemaStructs(imported.structs, 'CSV');
    }
    if (options.importPsv) {
        const { parseDelimitedFileToAst } = require('../dist/schema-io/DelimitedSchema');
        const imported = parseDelimitedFileToAst(path.resolve(options.importPsv), '|', options.importPsv);
        mergeSchemaStructs(imported.structs, 'PSV');
    }
    if (options.importJson) {
        const { parseJsonFileToAst } = require('../dist/schema-io/JsonSchema');
        const imported = parseJsonFileToAst(path.resolve(options.importJson), options.importJson);
        mergeSchemaStructs(imported.structs, 'JSON');
    }
    if (options.importExcel) {
        const { parseExcelFileToAst } = require('../dist/schema-io/ExcelSchema');
        const imported = parseExcelFileToAst(path.resolve(options.importExcel), options.importExcel);
        mergeSchemaStructs(imported.structs, 'Excel');
    }
    const parseTime = Date.now() - startTime;
    console.log(`Parsed ${ast.filesProcessed || 1} files in ${parseTime}ms`);
    console.log(`✅ Parsed in ${parseTime}ms`);

    const generationPromises = [];
    if (options.csharp) generationPromises.push(generateCSharp(engine, ast, outputDir, { ...options, defineVersionFile }));
    if (options.cpp) generationPromises.push(generateCpp(engine, ast, outputDir));
    if (options.ts) generationPromises.push(generateTypeScript(engine, ast, outputDir, options));
    if (options.js) generationPromises.push(generateJavaScript(engine, ast, outputDir, options));
    await Promise.all(generationPromises);

    if (options.convertToDeuk) {
        const legacyMigrator = path.join(__dirname, 'internal', 'legacy-migration', 'convert_thrift_to_deuk.js');
        let run;
        try {
            ({ run } = require(legacyMigrator));
        } catch (e) {
            console.error('❌ --convert-to-deuk: internal legacy migration scripts are not available.');
            console.error('   (OSS / npm package excludes project-specific legacy .thrift→.deuk rules.)');
            console.error('   Use the full DeukPack tree with scripts/internal/legacy-migration/, or migrate by other means.');
            process.exit(1);
        }
        await run(ast, thriftFile, outputDir, options.convertToDeukOutputDir, { emitPerFile: options.emitPerFile });
    }

    if (options.openapi) {
        const { generateOpenApiFromAst } = require('../dist/openapi/OpenApiGenerator');
        const spec = generateOpenApiFromAst(ast);
        const outPath = path.resolve(options.openapi);
        const ext = path.extname(outPath).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
            try {
                const yaml = require('js-yaml');
                await fs.writeFile(outPath, yaml.dump(spec, { lineWidth: -1 }), 'utf8');
            } catch (e) {
                if (e.code === 'MODULE_NOT_FOUND') {
                    throw new Error('YAML output requires js-yaml. Run: npm install js-yaml');
                }
                throw e;
            }
        } else {
            await fs.writeFile(outPath, JSON.stringify(spec, null, 2), 'utf8');
        }
        console.log(`   📄 OpenAPI emitted: ${options.openapi}`);
    }
    const firstStruct = ast.structs && ast.structs.length > 0 ? ast.structs[0] : null;
    if (options.csv && firstStruct) {
        const { emitDelimitedFromStruct } = require('../dist/schema-io/DelimitedSchema');
        const outPath = path.resolve(options.csv);
        await fs.writeFile(outPath, emitDelimitedFromStruct(firstStruct, ','), 'utf8');
        console.log(`   📄 CSV emitted: ${options.csv}`);
    }
    if (options.psv && firstStruct) {
        const { emitDelimitedFromStruct } = require('../dist/schema-io/DelimitedSchema');
        const outPath = path.resolve(options.psv);
        await fs.writeFile(outPath, emitDelimitedFromStruct(firstStruct, '|'), 'utf8');
        console.log(`   📄 PSV emitted: ${options.psv}`);
    }
    if (typeof options.json === 'string' && options.json && firstStruct) {
        const { emitJsonFromStruct } = require('../dist/schema-io/JsonSchema');
        const outPath = path.resolve(options.json);
        await fs.writeFile(outPath, emitJsonFromStruct(firstStruct), 'utf8');
        console.log(`   📄 JSON emitted: ${options.json}`);
    }
    if (options.excel && firstStruct) {
        const { emitExcelFromStruct } = require('../dist/schema-io/ExcelSchema');
        emitExcelFromStruct(firstStruct, path.resolve(options.excel));
        console.log(`   📄 Excel emitted: ${options.excel}`);
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
 * Pipeline config (JSON): { defineRoot?, includePaths?, jobs: [ { name?, thriftFile, outputDir, includePaths?, csharp?, cpp?, ts?, js?, json?, ef?, wireProfiles?, importOpenApi?, openapi?, copy?: [ { from, to } ] } ] }
 * ts: TypeScript (1st-stage). js: Path B direct JS. importOpenApi/openapi: OpenAPI ↔ Deuk round-trip. See docs/DEUKPACK_OPENAPI_ROUNDTRIP.md.
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
            ts: !!job.ts,
            js: !!job.js,
            json: !!job.json,
            importOpenApi: job.importOpenApi || undefined,
            openapi: job.openapi || undefined,
            ef: !!job.ef,
            defineRoot,
            convertToDeuk: !!job.convertToDeuk,
            convertToDeukOutputDir: job.convertToDeukOutputDir || 'deuk',
            csharpProjectName: job.csharpProjectName || 'DeukDefine',
            emitCsproj: job.emitCsproj !== false,
            wireProfiles: normalizeWireProfiles(job.wireProfiles)
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

/** CLI / pipeline: wire profile names for subset codegen (see DEUKPACK_WIRE_PROFILE_SUBSET.md). */
function normalizeWireProfiles(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
}

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
        ts: false,
        js: false,
        json: false,
        protocol: 'binary',
        endianness: 'little',
        defineRoot: undefined,  // --define-root idls | _thrift
        convertToDeuk: false,
        convertToDeukOutputDir: 'deuk',  // --convert-to-deuk [subdir]
        emitPerFile: false,  // --emit-per-file  AST 내 각 sourceFile별 .deuk 추가 출력 (server_msg_db 등)
        ef: false,  // --ef  Entity Framework support (meta table entities + DbContext)
        csharpProjectName: 'DeukDefine',  // --csharp-project-name <name>  emitted .csproj AssemblyName/filename
        emitCsproj: true,  // set false with --no-csharp-csproj to skip generating DeukDefine.csproj
        wireProfiles: []
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
            case '--ts':
                options.ts = true;
                break;
            case '--js':
                options.js = true;
                break;
            case '--ef':
                options.ef = true;
                break;
            case '--wire-profile':
                if (i + 1 < args.length) {
                    const raw = args[++i];
                    raw.split(',').forEach((part) => {
                        const t = part.trim();
                        if (t) options.wireProfiles.push(t);
                    });
                }
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
            case '--import-openapi':
                if (i + 1 < args.length) {
                    options.importOpenApi = args[++i];
                }
                break;
            case '--openapi':
                if (i + 1 < args.length) {
                    options.openapi = args[++i];
                }
                break;
            case '--import-csv':
                if (i + 1 < args.length) {
                    options.importCsv = args[++i];
                }
                break;
            case '--import-psv':
                if (i + 1 < args.length) {
                    options.importPsv = args[++i];
                }
                break;
            case '--import-json':
                if (i + 1 < args.length) {
                    options.importJson = args[++i];
                }
                break;
            case '--import-excel':
                if (i + 1 < args.length) {
                    options.importExcel = args[++i];
                }
                break;
            case '--csv':
                if (i + 1 < args.length) {
                    options.csv = args[++i];
                }
                break;
            case '--psv':
                if (i + 1 < args.length) {
                    options.psv = args[++i];
                }
                break;
            case '--json':
                if (i + 1 < args.length) {
                    options.json = args[++i];
                }
                break;
            case '--excel':
                if (i + 1 < args.length) {
                    options.excel = args[++i];
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

    const genOptions = {
        efSupport: options.ef === true,
        defineVersionFile: options.defineVersionFile,
        wireProfilesEmit: normalizeWireProfiles(options.wireProfiles)
    };
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
 * Generate TypeScript (1st-stage types). JS via app build (Path A) or tsc. See docs/DEUKPACK_JS_BUILD_PIPELINE.md.
 */
async function generateTypeScript(engine, ast, outputDir, options = {}) {
    console.log('🔧 Generating TypeScript code...');
    const startTime = Date.now();

    const tsDir = path.join(outputDir, 'typescript');
    await fs.mkdir(tsDir, { recursive: true });

    const { TypeScriptGenerator } = require('../dist/codegen/TypeScriptGenerator');
    const generator = new TypeScriptGenerator();
    const tsFiles = await generator.generate(ast, {});

    for (const [filename, content] of Object.entries(tsFiles)) {
        if (!filename || filename === 'nul.ts' || filename.startsWith('nul')) {
            console.warn(`   ⚠️  Skipping invalid filename: ${filename}`);
            continue;
        }
        const filePath = path.join(tsDir, filename);
        if (filePath.includes('\\nul\\') || filePath.endsWith('\\nul')) {
            console.warn(`   ⚠️  Skipping invalid path: ${filePath}`);
            continue;
        }
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`   📄 Generated: ${filename}`);
    }

    const generateTime = Date.now() - startTime;
    console.log(`✅ TypeScript generated ${Object.keys(tsFiles).length} files in ${generateTime}ms`);
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
 * Get schema type string for a DeukPack (IDL) field type. typeName은 득팩 표준으로 출력(엑셀 스키마 뷰/비교용).
 * @param {any} fieldType - string e.g. 'i32' or object e.g. { type: 'list', elementType: 'i32' }
 * @returns {{ type: string, typeName: string }}
 */
function csharpSuffixFromProfile(profile) {
    const parts = String(profile).trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if (parts.length === 0) return '_Subset';
    return '_' + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

function fieldIncludedInWireProfileJs(field, profileLower) {
    const ann = field.annotations;
    if (!ann) return true;
    const raw = ann.wireProfiles != null ? ann.wireProfiles : ann.wire_profiles;
    if (raw == null || String(raw).trim() === '') return true;
    const list = String(raw).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list.includes(profileLower);
}

function filterStructFieldsForProfileJs(struct, profileLower) {
    return (struct.fields || []).filter((f) => fieldIncludedInWireProfileJs(f, profileLower));
}

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

/**
 * Generate JavaScript (Path B: direct JS for Node/tools).
 * JS build pipeline: docs/DEUKPACK_JS_BUILD_PIPELINE.md — Path A = TS 1st then app build; Path B = this direct --js output.
 * Output: DeukPack JS objects (getSchema(), toJson/fromJson, applyOverrides, projectFields). Consumer-agnostic.
 */
async function generateJavaScript(engine, ast, outputDir, options = {}) {
    console.log('🔧 Generating JavaScript code...');
    DeukPackEngine.resolveExtends(ast);
    const startTime = Date.now();

    const jsDir = path.join(outputDir, 'javascript');
    await fs.mkdir(jsDir, { recursive: true });

    const lines = [];
    lines.push('// Generated by DeukPack v1.0.0');
    lines.push('// ' + new Date().toISOString());
    lines.push('// JS build pipeline: Path B (direct JS). See DeukPack docs/DEUKPACK_JS_BUILD_PIPELINE.md');
    lines.push('// DeukPack JS objects with embedded schema (getSchema(), toJson/fromJson).');
    lines.push('// Protocol helpers: toJson/fromJson (DeukPack JSON), toBinary/fromBinary (binary).');
    lines.push('');

    lines.push('// --- Protocol runtime (DeukPack JSON shape: field-id keys, { i32|str|lst|map|rec|... } wrappers) ---');
    lines.push('function _wrapDpJson(type, typeName, val, schemas) {');
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
    lines.push('      return { lst: (val || []).map(function(e) { return _wrapDpJson(_elemType(elem), elem, e, schemas); }) };');
    lines.push('    case "Map":');
    lines.push('      var m = (typeName.match(/^map<([^,]+),(.+)>$/) || []);');
    lines.push('      var out = {};');
    lines.push('      for (var k in val) if (Object.prototype.hasOwnProperty.call(val, k)) out[String(k)] = _wrapDpJson(_elemType(m[2]), m[2], val[k], schemas);');
    lines.push('      return { map: out };');
    lines.push('    default:');
    lines.push('      var s = schemas && schemas[typeName];');
    lines.push('      return s ? { rec: _toDpJson(s, val, schemas) } : { str: String(val) };');
    lines.push('  }');
    lines.push('}');
    lines.push('function _elemType(tn) { if (!tn) return "String"; var m = tn.match(/^(?:list|set)<(.+)>$/); return m ? _elemType(m[1]) : (tn === "i32" || tn === "i64" ? "I32" : (tn === "double" ? "Double" : (tn === "string" ? "String" : "Struct"))); }');
    lines.push('function _toDpJson(schema, obj, schemas) {');
    lines.push('  if (!schema || schema.type !== "Struct" || !schema.fields) return obj;');
    lines.push('  var out = {};');
    lines.push('  for (var id in schema.fields) { var f = schema.fields[id]; var v = obj && obj[f.name]; if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue; if (v !== undefined) out[String(id)] = _wrapDpJson(f.type, f.typeName, v, schemas); }');
    lines.push('  return out;');
    lines.push('}');
    lines.push('function _unwrapDpJson(type, typeName, jsonVal, schemas) {');
    lines.push('  if (jsonVal === null || jsonVal === undefined) return null;');
    lines.push('  if (type !== "Struct" && typeof jsonVal === "object" && !Array.isArray(jsonVal)) {');
    lines.push('    if (type === "Binary" && jsonVal.str) { var b64 = jsonVal.str; if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64")); var bin = typeof atob !== "undefined" ? atob(b64) : ""; var arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; }');
    lines.push('    if (jsonVal.str !== undefined) return jsonVal.str;');
    lines.push('    if (jsonVal.i32 !== undefined) return jsonVal.i32;');
    lines.push('    if (jsonVal.i64 !== undefined) return Number(jsonVal.i64);');
    lines.push('    if (jsonVal.dbl !== undefined) return jsonVal.dbl;');
    lines.push('    if (jsonVal.tf !== undefined) return jsonVal.tf;');
    lines.push('    if (jsonVal.lst !== undefined) { var elem = (typeName.match(/^(?:list|set)<(.+)>$/) || [])[1]; return jsonVal.lst.map(function(e) { return _unwrapDpJson(_elemType(elem), elem, e, schemas); }); }');
    lines.push('    if (jsonVal.map !== undefined) { var m = (typeName.match(/^map<([^,]+),(.+)>$/) || []); var o = {}; for (var k in jsonVal.map) o[k] = _unwrapDpJson(_elemType(m[2]), m[2], jsonVal.map[k], schemas); return o; }');
    lines.push('    if (jsonVal.rec !== undefined) { var s = schemas && schemas[typeName]; return s ? _fromDpJson(s, jsonVal.rec, schemas) : jsonVal.rec; }');
    lines.push('  }');
    lines.push('  return jsonVal;');
    lines.push('}');
    lines.push('function _fromDpJson(schema, jsonObj, schemas) {');
    lines.push('  if (!schema || schema.type !== "Struct" || !schema.fields) return jsonObj || {};');
    lines.push('  var out = {};');
    lines.push('  for (var id in schema.fields) { var f = schema.fields[id]; var w = jsonObj && jsonObj[String(id)]; if (w !== undefined) out[f.name] = _unwrapDpJson(f.type, f.typeName, w, schemas); }');
    lines.push('  return out;');
    lines.push('}');
    lines.push('');


    lines.push('// --- WriteWithOverrides runtime: apply field-id overrides without cloning ---');
    lines.push('function _applyOverrides(obj, overrides, schema) {');
    lines.push('  if (!overrides || !schema || !schema.fields) return obj;');
    lines.push('  var out = {};');
    lines.push('  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];');
    lines.push('  for (var id in overrides) {');
    lines.push('    var f = schema.fields[id];');
    lines.push('    if (f) out[f.name] = overrides[id];');
    lines.push('  }');
    lines.push('  return out;');
    lines.push('}');
    lines.push('');
    lines.push('// --- WriteFields runtime: project only specified field IDs (+ optional overrides) ---');
    lines.push('function _projectFields(obj, fieldIds, schema, overrides) {');
    lines.push('  if (!fieldIds || !schema || !schema.fields) return {};');
    lines.push('  var set = {}; for (var i = 0; i < fieldIds.length; i++) set[fieldIds[i]] = true;');
    lines.push('  var out = {};');
    lines.push('  for (var fid in schema.fields) {');
    lines.push('    if (!set[fid]) continue;');
    lines.push('    var f = schema.fields[fid];');
    lines.push('    out[f.name] = (overrides && overrides[fid] !== undefined) ? overrides[fid] : obj[f.name];');
    lines.push('  }');
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
        lines.push('  toJson(obj) { return JSON.stringify(_toDpJson(_schema_' + safeName + ', obj, _schemas)); },');
        lines.push('  fromJson(str) { return _fromDpJson(_schema_' + safeName + ', JSON.parse(str || "{}"), _schemas); },');
        lines.push('  toBinary(obj) { throw new Error("toBinary: use C#/TS runtime or DeukPack binary protocol"); },');
        lines.push('  fromBinary(buf) { throw new Error("fromBinary: use C#/TS runtime or DeukPack binary protocol"); },');
        lines.push('  applyOverrides(obj, overrides) { return _applyOverrides(obj, overrides, _schema_' + safeName + '); },');
        lines.push('  toJsonWithOverrides(obj, overrides) { return JSON.stringify(_toDpJson(_schema_' + safeName + ', _applyOverrides(obj, overrides, _schema_' + safeName + '), _schemas)); },');
        lines.push('  projectFields(obj, fieldIds, overrides) { return _projectFields(obj, fieldIds, _schema_' + safeName + ', overrides); },');
        lines.push('  toJsonWithFields(obj, fieldIds, overrides) { return JSON.stringify(_toDpJson(_schema_' + safeName + ', _projectFields(obj, fieldIds, _schema_' + safeName + ', overrides), _schemas)); },');
        const fieldIdEntries = (struct.fields || []).map(f => {
            const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
            return `${cap}: ${f.id}`;
        });
        lines.push('  FieldId: { ' + fieldIdEntries.join(', ') + ' }');
        lines.push('};');
        lines.push('');
    }

    const wireProfilesJs = normalizeWireProfiles(options.wireProfiles);
    const wireProfileExportNames = [];
    for (const profile of wireProfilesJs) {
        const profileLower = profile.toLowerCase();
        const suffix = csharpSuffixFromProfile(profile);
        for (const struct of ast.structs || []) {
            const filtered = filterStructFieldsForProfileJs(struct, profileLower);
            if (filtered.length === 0) continue;
            const subsetExportName = struct.name.replace(/\./g, '_') + suffix;
            wireProfileExportNames.push(subsetExportName);
            const fieldsObj = {};
            for (const field of filtered) {
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
                annotations: struct.annotations && Object.keys(struct.annotations).length ? struct.annotations : undefined,
                wireProfile: profile
            };
            const schemaJson = JSON.stringify(schemaObj);
            lines.push(`// wire profile "${profile}" subset`);
            lines.push(`const _schema_${subsetExportName} = ${schemaJson};`);
            lines.push(`const ${subsetExportName} = {`);
            lines.push('  getSchema() { return _schema_' + subsetExportName + '; },');
            lines.push('  create() { return {}; },');
            lines.push('  toJson(obj) { return JSON.stringify(_toDpJson(_schema_' + subsetExportName + ', obj, _schemas)); },');
            lines.push('  fromJson(str) { return _fromDpJson(_schema_' + subsetExportName + ', JSON.parse(str || "{}"), _schemas); },');
            lines.push('  toBinary(obj) { throw new Error("toBinary: use C#/TS runtime or DeukPack binary protocol"); },');
            lines.push('  fromBinary(buf) { throw new Error("fromBinary: use C#/TS runtime or DeukPack binary protocol"); },');
            lines.push('};');
            lines.push('');
        }
    }

    lines.push('var _schemas = {};');
    for (const struct of ast.structs || []) {
        const safeName = struct.name.replace(/\./g, '_');
        lines.push('_schemas["' + struct.name.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
    }
    for (const profile of wireProfilesJs) {
        const profileLower = profile.toLowerCase();
        const suffix = csharpSuffixFromProfile(profile);
        for (const struct of ast.structs || []) {
            const filtered = filterStructFieldsForProfileJs(struct, profileLower);
            if (filtered.length === 0) continue;
            const subsetExportName = struct.name.replace(/\./g, '_') + suffix;
            const schemaKey = struct.name + suffix;
            lines.push('_schemas["' + schemaKey.replace(/"/g, '\\"') + '"] = _schema_' + subsetExportName + ';');
        }
    }
    lines.push('var _enums = {};');
    for (const enumDef of ast.enums || []) {
        const safeName = enumDef.name.replace(/\./g, '_');
        lines.push('_enums["' + enumDef.name.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
    }
    lines.push('');

    // Export for Node/UMD
    lines.push('if (typeof module !== "undefined" && module.exports) {');
    const allNames = []
        .concat((ast.enums || []).map(e => e.name.replace(/\./g, '_')))
        .concat((ast.structs || []).map(s => s.name.replace(/\./g, '_')))
        .concat(wireProfileExportNames);
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
