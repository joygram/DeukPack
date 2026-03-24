#!/usr/bin/env node

/**
 * DeukPack Builder
 * 100x faster than Apache Thrift with multi-language support
 * Supports single-file mode and --pipeline <config.json> for multi-job + copy steps.
 */

const { DeukPackEngine } = require('../dist/index');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const _deukpackPkg = require('../package.json');
const DEUKPACK_CLI_VERSION = typeof _deukpackPkg.version === 'string' ? _deukpackPkg.version : 'unknown';

/**
 * True if the CLI will produce codegen, convert, or schema emit output (not parse-only).
 */
function defaultPipelinePath() {
    return path.join(process.cwd(), 'deukpack.pipeline.json');
}

function warnIfNoPipelineFileAtCwd() {
    if (fsSync.existsSync(defaultPipelinePath())) return;
    console.warn(
        '[deukpack] No deukpack.pipeline.json in this working directory. This one-shot invocation will still run; for a repeatable setup, run: npx deukpack init'
    );
}

function hasCodegenOrEmit(options) {
    return !!(
        options.csharp ||
        options.cpp ||
        options.ts ||
        options.js ||
        options.convertToDeuk ||
        (options.openapi && String(options.openapi).trim()) ||
        (options.csv && String(options.csv).trim()) ||
        (options.psv && String(options.psv).trim()) ||
        (typeof options.json === 'string' && options.json.trim()) ||
        (options.excel && String(options.excel).trim())
    );
}

/**
 * @param {{ full?: boolean, useStdout?: boolean }} [opts]
 */
function printCliUsage(opts = {}) {
    const full = !!opts.full;
    const useStdout = !!opts.useStdout;
    const line = useStdout ? (...a) => console.log(...a) : (...a) => console.error(...a);

    line(`DeukPack CLI v${DEUKPACK_CLI_VERSION}`);
    line('');
    line('Usage:');
    line('  deukpack init | deukpack config   Pipeline + workspace bootstrap + VSIX install last (unless --skip-vsix); --non-interactive uses defaults + npm sync');
    line('  deukpack bootstrap               Same as: deukpack init --workspace-only');
    line('  deukpack run [pipeline.json]      Run --pipeline on ./deukpack.pipeline.json or a given file');
    line('  deukpack <entry.deuk> <outDir> [flags]');
    line('  deukpack build <entry.deuk> <outDir> [flags]   (same)');
    line('  deukpack --pipeline <config.json>   (jobs: defineScope "all" = every .deuk under defineRoot minus exclude; else thriftFile entry)');
    line('  deukpack bootstrap [args]');
    line('  deukpack sync-runtime [args]');
    line('');
    line('Includes (single-shot CLI):');
    line('  The entry file’s directory is always searched.');
    line('  -I <dir>   add one include directory.');
    line('  -r <dir>   add that directory and all nested subdirectories (deep recursion).');
    line('  Pipeline JSON: { "path": "<dir>", "recursive": true } matches -r.');
    line('  Alternative: rely on one umbrella .deuk and only paths reachable from its folder.');
    line('');
    line('Pick at least one output mode, e.g.:');
    line('  --csharp   C# (+ .csproj by default)   --ts   TypeScript   --js   JavaScript   --cpp   C++');
    line('  --openapi <file>   emit OpenAPI from AST');
    line('  --convert-to-deuk [subdir]   emit .deuk from legacy .thrift (full tree only)');
    line('  --csv/--psv/--json/--excel <file>   emit table schema from first struct');
    line('');
    line('Typical (Unity/game IDL):');
    line('  deukpack path/to/root.deuk ./gen --csharp -r path/to/_deuk_define');
    line('');
    line('From repo: node scripts/build_deukpack.js …   (same arguments as deukpack)');
    if (!full) {
        line('');
        line('Full flag list: deukpack help --full');
        return;
    }
    line('');
    line('All flags:');
    line('  -I, -i <path>   Include path (individual)');
    line('  -r <path>       That directory + all nested subdirectories (deep recursion; same as pipeline recursive)');
    line('  --define-root <name>  IDL root folder (default: _deuk_define, legacy: _thrift)');
    line('  --csharp    Generate C# code (and DeukDefine.csproj by default)');
    line('  --csharp-project-name <name>  C# project/assembly name (default: DeukDefine)');
    line('  --csharp-nullable    Enable Nullable Reference Types in generated C#');
    line('  --no-csharp-csproj    Do not emit .csproj when generating C#');
    line('  --allow-multi-namespace  Permit multiple namespace blocks in a single IDL file');
    line('  --brace-less-namespace   Omit namespace { } braces in output for single-namespace files (indented)');
    line('  --cpp       Generate C++ code');
    line('  --ts        Generate TypeScript under <out>/ts/ (1st-stage types; JS via app build or tsc). See docs/DEUKPACK_JS_BUILD_PIPELINE.md');
    line('  --js        Generate JavaScript under <out>/js/ (Path B: direct JS for Node/tools). App bundle: use TS output + app build.');
    line('  --protocol <protocol>  Wire hint: deuk pack|json|yaml (default pack); Thrift interop tbinary|tcompact|tjson — see docs/DEUKPACK_WIRE_INTEROP_VS_NATIVE.md');
    line('  --endianness <endian>  Endianness (little|big)');
    line('  --convert-to-deuk [subdir]  Emit .deuk from parsed .thrift (subdir default: deuk). Legacy→table migration.');
    line('  --ef    Enable Entity Framework support ( [Table]/[Key]/[Column] + DeukPackDbContext.g.cs ).');
    line('  --wire-profile <name>  Repeat or comma-separated: emit C# (and --js) subset types per profile (annotation wireProfiles on fields).');
    line('  --import-openapi <file>  Merge OpenAPI 3.x components/schemas into AST.');
    line('  --openapi <file>  Emit OpenAPI 3.x from AST.');
    line('  --import-csv/--import-psv/--import-json/--import-excel <file>  Merge schema (first row/keys) into AST.');
    line('  --csv/--psv/--json/--excel <file>  Emit schema from AST (first struct). Round-trip: format → deuk → format.');
}

async function main(argv) {
    const args = argv !== undefined ? argv : process.argv.slice(2);

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
        printCliUsage({ full: false, useStdout: false });
        process.exit(1);
    }

    const thriftFile = args[0];
    const outputDir = args[1];
    const { options, includePaths: extraIncludePaths, includePathsRecursive } = parseOptions(args.slice(2));

    if (!hasCodegenOrEmit(options)) {
        console.error('❌ No output mode specified (parse-only is not supported). Add e.g. --csharp, --ts, --openapi <file>, …');
        printCliUsage({ full: false, useStdout: false });
        process.exit(1);
    }

    warnIfNoPipelineFileAtCwd();

    const baseDir = path.dirname(path.resolve(thriftFile));
    const expandedRecursive = await expandRecursiveIncludePaths(includePathsRecursive.map(p => path.resolve(p)));
    const includePaths = [baseDir, ...extraIncludePaths, ...expandedRecursive];
    const parseOpts = {
        includePaths,
        defineRoot: options.defineRoot,
        allowMultiNamespace: options.allowMultiNamespace === true
    };

    console.log(`🚀 DeukPack Builder v${DEUKPACK_CLI_VERSION}`);
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
 * @param {string} outputDir - Base directory; per-language output is outputDir plus subdirs (default csharp, cpp, ts, js; partial override via options.langOutputSubdirs).
 * @param {object} options - { csharp, cpp, ts, js, json, defineRoot, wireProfiles, langOutputSubdirs? }
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
    const langOutputSubdirs = mergeLangOutputSubdirs(options.langOutputSubdirs);
    options = { ...options, langOutputSubdirs };
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
    if (options.cpp) generationPromises.push(generateCpp(engine, ast, outputDir, options));
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
 * Expand each root directory to itself and every nested subdirectory (depth-first).
 * Each entry in dirPaths is an absolute path.
 */
async function expandRecursiveIncludePaths(dirPaths) {
    const seen = new Set();
    async function walk(absDir) {
        const norm = path.resolve(absDir);
        if (seen.has(norm)) return;
        let st;
        try {
            st = await fs.stat(norm);
        } catch {
            console.warn(`   ⚠️  Skip recursive include (missing or not readable): ${absDir}`);
            return;
        }
        if (!st.isDirectory()) return;
        seen.add(norm);
        let entries;
        try {
            entries = await fs.readdir(norm, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                await walk(path.join(norm, e.name));
            }
        }
    }
    for (const dir of dirPaths) {
        await walk(dir);
    }
    return [...seen];
}

const DEUKPACK_SKIP_WALK_DIRS = new Set(['node_modules', '.git', 'bin', 'obj', 'Library']);

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {string[]}
 */
function mergeExcludePatterns(a, b) {
    const g = Array.isArray(a) ? a : [];
    const j = Array.isArray(b) ? b : [];
    return [...g, ...j].map((x) => String(x).trim()).filter(Boolean);
}

/**
 * @param {string} relPosix path under define root, forward slashes
 * @param {string} patternRaw exclude pattern (see docs/DEUKPACK_PIPELINE_AND_ENTRY.md)
 */
function pathMatchesExclude(relPosix, patternRaw) {
    const norm = relPosix.replace(/\\/g, '/');
    const p0 = String(patternRaw).trim().replace(/\\/g, '/');
    if (!p0) return false;
    if (p0.includes('*')) {
        if (p0.startsWith('**/')) {
            const suf = p0.slice(3);
            return norm === suf || norm.endsWith('/' + suf);
        }
        if (p0.startsWith('*') && !p0.includes('/')) {
            return norm.endsWith(p0.slice(1));
        }
    }
    const asTree = p0.endsWith('/') || p0.endsWith('/**');
    const base = p0.replace(/\/\*\*$/, '').replace(/\/$/, '');
    if (asTree) {
        return norm === base || norm.startsWith(base + '/');
    }
    return norm === p0 || norm === base;
}

/**
 * @param {string} relPosix
 * @param {string[]} patterns
 */
function isExcludedRel(relPosix, patterns) {
    if (!patterns.length) return false;
    return patterns.some((p) => pathMatchesExclude(relPosix, p));
}

/**
 * @param {string} defineRootAbs
 * @param {string[]} excludePatterns
 * @returns {Promise<string[]>} relative POSIX paths from define root
 */
async function collectDeukRelPaths(defineRootAbs, excludePatterns) {
    const out = [];
    async function walk(absDir, relPosix) {
        let entries;
        try {
            entries = await fs.readdir(absDir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.name === '.' || e.name === '..') continue;
            const rel = relPosix ? `${relPosix}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (DEUKPACK_SKIP_WALK_DIRS.has(e.name)) continue;
                if (isExcludedRel(rel + '/', excludePatterns)) continue;
                await walk(path.join(absDir, e.name), rel);
            } else if (e.name.endsWith('.deuk')) {
                if (!isExcludedRel(rel, excludePatterns)) out.push(rel);
            }
        }
    }
    try {
        await fs.access(defineRootAbs);
    } catch {
        throw new Error(`defineRoot not found: ${defineRootAbs}`);
    }
    await walk(defineRootAbs, '');
    out.sort();
    return out;
}

/**
 * @param {object} job
 * @returns {'all' | 'entry'}
 */
function resolveJobDefineScope(job) {
    if (job.defineScope === 'all') return 'all';
    if (job.defineScope === 'entry') return 'entry';
    const tf = job.thriftFile != null ? String(job.thriftFile).trim() : '';
    if (tf) return 'entry';
    return 'all';
}

/**
 * @returns {Promise<{ absPath: string, cleanup: (() => Promise<void>) | null }>}
 */
async function preparePipelineEntryThriftPath({
    job,
    jobIndex,
    configDir,
    defineRoot,
    globalExclude,
}) {
    const scope = resolveJobDefineScope(job);
    const dr = defineRoot || '_deuk_define';
    const defineRootAbs = path.resolve(configDir, dr);
    const exclude = mergeExcludePatterns(globalExclude, job.exclude);

    if (scope === 'entry') {
        const tf = job.thriftFile != null ? String(job.thriftFile).trim() : '';
        if (!tf) {
            throw new Error(
                `Pipeline job "${job.name || jobIndex}" needs "thriftFile" or set defineScope to "all"`
            );
        }
        const abs = path.resolve(configDir, tf);
        try {
            await fs.access(abs);
        } catch {
            throw new Error(`Pipeline job entry file not found: ${tf}`);
        }
        return { absPath: abs, cleanup: null };
    }

    const rels = await collectDeukRelPaths(defineRootAbs, exclude);
    if (rels.length === 0) {
        throw new Error(`defineScope "all": no .deuk files under "${dr}" (after exclude)`);
    }
    const esc = (s) => s.replace(/\\/g, '/').replace(/"/g, '\\"');
    const body = [
        '// Auto-generated by deukpack pipeline (defineScope: all). Do not edit.',
        ...rels.map((r) => `include "${esc(r)}"`),
    ].join('\n');
    const safeName = String(job.name || `job${jobIndex}`).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const bundleAbs = path.join(defineRootAbs, `__deukpack_pipeline_bundle_${jobIndex}_${safeName}.deuk`);
    await fs.writeFile(bundleAbs, `${body}\n`, 'utf8');
    console.log(`   📎 defineScope all: bundled ${rels.length} .deuk → ${path.relative(configDir, bundleAbs)}`);
    return {
        absPath: bundleAbs,
        cleanup: async () => {
            await fs.unlink(bundleAbs).catch(() => {});
        },
    };
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

const DEFAULT_LANG_OUTPUT_SUBDIRS = Object.freeze({
    csharp: 'csharp',
    cpp: 'cpp',
    ts: 'ts',
    js: 'js',
});

/**
 * @param {string} name
 * @param {string} field
 * @returns {string}
 */
function assertLangOutputSubdirSegment(name, field) {
    const s = String(name).trim();
    if (!s || s === '.' || s === '..' || s.includes('..') || s.includes('/') || s.includes('\\')) {
        throw new Error(`Invalid outputLangSubdirs.${field}: must be a single directory name, got "${name}"`);
    }
    return s;
}

/**
 * @param {Record<string, unknown> | null | undefined} partial
 * @returns {{ csharp: string, cpp: string, ts: string, js: string }}
 */
function mergeLangOutputSubdirs(partial) {
    const out = {
        csharp: DEFAULT_LANG_OUTPUT_SUBDIRS.csharp,
        cpp: DEFAULT_LANG_OUTPUT_SUBDIRS.cpp,
        ts: DEFAULT_LANG_OUTPUT_SUBDIRS.ts,
        js: DEFAULT_LANG_OUTPUT_SUBDIRS.js,
    };
    if (!partial || typeof partial !== 'object') return out;
    for (const k of ['csharp', 'cpp', 'ts', 'js']) {
        if (partial[k] != null && String(partial[k]).trim() !== '') {
            out[k] = assertLangOutputSubdirSegment(String(partial[k]), k);
        }
    }
    return out;
}

/**
 * @param {object} config
 * @returns {string}
 */
function normalizeConfigDefineRoot(config) {
    if (config.defineRoot != null && String(config.defineRoot).trim() !== '') {
        return String(config.defineRoot).trim().replace(/\\/g, '/');
    }
    return '_deuk_define';
}

/**
 * Default job output base = defineRoot (e.g. _deuk_define) so emits land in _deuk_define/csharp, …/ts, …/js, …/cpp.
 * @param {object} job
 * @param {object} config
 * @returns {string}
 */
function resolvePipelineJobOutputDir(job, config) {
    const od = job.outputDir;
    if (od == null || (typeof od === 'string' && od.trim() === '')) {
        return normalizeConfigDefineRoot(config);
    }
    return typeof od === 'string' ? od.trim().replace(/\\/g, '/') : String(od);
}

/**
 * Pipeline config (JSON): { defineRoot?, exclude?, includePaths?, jobs: [ { name?, defineScope?, thriftFile?, exclude?, outputDir?, outputLangSubdirs?, … } ] }
 * defineScope: "all" (default when thriftFile omitted) = every .deuk under defineRoot, minus exclude; "entry" = thriftFile required.
 * exclude: string[] relative to defineRoot (merged: config.exclude + job.exclude). See docs/DEUKPACK_PIPELINE_AND_ENTRY.md.
 * outputDir: optional; omitted = same as defineRoot (default _deuk_define). Per-language folders: csharp, cpp, ts, js (override outputLangSubdirs).
 * ts: TypeScript (1st-stage). js: Path B direct JS. See docs/DEUKPACK_OPENAPI_ROUNDTRIP.md, docs/DEUKPACK_PIPELINE_AND_ENTRY.md.
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
    const globalEx = Array.isArray(config.exclude) ? config.exclude : [];
    const globalIncludePaths = await resolveIncludePathsFromConfig(config.includePaths || [], configDir);

    console.log(`🚀 DeukPack Pipeline v${DEUKPACK_CLI_VERSION}`);
    console.log(`📄 Config: ${configPath}`);
    console.log(`   Jobs: ${jobs.length}`);

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const name = job.name || job.thriftFile || `job${i + 1}`;
        const outputRel = resolvePipelineJobOutputDir(job, config);
        const outputDir = path.resolve(configDir, outputRel);
        const jobIncludePaths = await resolveIncludePathsFromConfig(job.includePaths || [], configDir);
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
            csharpNullable: !!job.csharpNullable,
            emitCsproj: job.emitCsproj !== false,
            wireProfiles: normalizeWireProfiles(job.wireProfiles),
            allowMultiNamespace: !!job.allowMultiNamespace,
            braceLessNamespace: !!job.braceLessNamespace,
            langOutputSubdirs: job.outputLangSubdirs
        };

        console.log(`\n--- Job: ${name} ---`);
        let prepared = null;
        try {
            prepared = await preparePipelineEntryThriftPath({
                job,
                jobIndex: i,
                configDir,
                defineRoot,
                globalExclude: globalEx,
            });
            const absEntry = prepared.absPath;
            const baseDir = path.dirname(absEntry);
            const includePaths = [baseDir, ...globalIncludePaths, ...jobIncludePaths];
            const parseOpts = {
                includePaths,
                defineRoot,
                allowMultiNamespace: !!job.allowMultiNamespace
            };
            await runOneBuild(absEntry, outputDir, options, parseOpts);
        } finally {
            if (prepared && prepared.cleanup) await prepared.cleanup();
        }

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
        protocol: 'pack',
        endianness: 'little',
        defineRoot: undefined,  // --define-root _deuk_define | _thrift
        convertToDeuk: false,
        convertToDeukOutputDir: 'deuk',  // --convert-to-deuk [subdir]
        emitPerFile: false,  // --emit-per-file  AST 내 각 sourceFile별 .deuk 추가 출력 (server_msg_db 등)
        ef: false,  // --ef  Entity Framework support (meta table entities + DbContext)
        csharpProjectName: 'DeukDefine',  // --csharp-project-name <name>  emitted .csproj AssemblyName/filename
        csharpNullable: false,           // --csharp-nullable  Enable #nullable enable
        emitCsproj: true,  // set false with --no-csharp-csproj to skip generating DeukDefine.csproj
        wireProfiles: [],
        allowMultiNamespace: false,
        braceLessNamespace: false
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
            case '--csharp-nullable':
                options.csharpNullable = true;
                break;
            case '--allow-multi-namespace':
                options.allowMultiNamespace = true;
                break;
            case '--brace-less-namespace':
                options.braceLessNamespace = true;
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

    const WIRE_ALLOWED = new Set(['pack', 'json', 'yaml', 'tbinary', 'tcompact', 'tjson']);
    if (!WIRE_ALLOWED.has(options.protocol)) {
        throw new Error(
            `Unknown --protocol "${options.protocol}". Use pack|json|yaml|tbinary|tcompact|tjson.`
        );
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
    <Nullable>@@NULLABLE@@</Nullable>
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

    const csharpDir = path.join(outputDir, options.langOutputSubdirs.csharp);
    await fs.mkdir(csharpDir, { recursive: true });

    // Use the actual C# generator
    const { CSharpGenerator } = require('../dist/codegen/CSharpGenerator');
    const generator = new CSharpGenerator();

    const genOptions = {
        efSupport: options.ef === true,
        csharpNullable: options.csharpNullable === true,
        defineVersionFile: options.defineVersionFile,
        wireProfilesEmit: normalizeWireProfiles(options.wireProfiles),
        allowMultiNamespace: options.allowMultiNamespace === true,
        braceLessNamespace: options.braceLessNamespace === true
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
        let csprojContent = getDefaultCsprojContent(projectName);
        csprojContent = csprojContent.replace('@@NULLABLE@@', options.csharpNullable ? 'enable' : 'disable');
        await fs.writeFile(csprojPath, csprojContent, 'utf8');
        console.log(`   📄 Generated: ${csprojName}`);
    }

    const generateTime = Date.now() - startTime;
    console.log(`✅ C# generated ${Object.keys(csharpFiles).length} files in ${generateTime}ms`);
}

async function generateCpp(engine, ast, outputDir, options = {}) {
    console.log('🔧 Generating C++ code...');
    const startTime = Date.now();

    const cppDir = path.join(outputDir, options.langOutputSubdirs.cpp);
    await fs.mkdir(cppDir, { recursive: true });

    const { CppGenerator } = require('../dist/codegen/cpp');
    const generator = new CppGenerator();
    const cppGenOptions = {
        targetLanguage: 'cpp',
        outputDir: cppDir,
        generateTypes: true,
        generateSerializers: true,
        generateDeserializers: true,
        generateValidators: false,
        generateTests: false,
        indentSize: 2,
        useTabs: false,
        braceLessNamespace: options.braceLessNamespace === true,
        allowMultiNamespace: options.allowMultiNamespace === true
    };
    const cppFiles = await generator.generate(ast, cppGenOptions);

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

    const tsDir = path.join(outputDir, options.langOutputSubdirs.ts);
    await fs.mkdir(tsDir, { recursive: true });

    const { TypeScriptGenerator } = require('../dist/codegen/typescript');
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
 * Generate JavaScript (Path B: direct JS for Node/tools).
 * JS build pipeline: docs/DEUKPACK_JS_BUILD_PIPELINE.md — Path A = TS 1st then app build; Path B = this direct --js output.
 * Output: DeukPack JS objects (getSchema(), toJson/fromJson, applyOverrides, projectFields). Consumer-agnostic.
 */
async function generateJavaScript(engine, ast, outputDir, options = {}) {
    console.log('🔧 Generating JavaScript code...');
    const startTime = Date.now();

    const jsDir = path.join(outputDir, options.langOutputSubdirs.js);
    await fs.mkdir(jsDir, { recursive: true });

    const { JavaScriptGenerator } = require('../dist/codegen/javascript');
    const generator = new JavaScriptGenerator();
    const genOptions = {
        wireProfilesEmit: normalizeWireProfiles(options.wireProfiles)
    };
    const jsFiles = await generator.generate(ast, genOptions);

    for (const [filename, content] of Object.entries(jsFiles)) {
        if (!filename || filename === 'nul.js' || filename.startsWith('nul')) {
            console.warn(`   ⚠️  Skipping invalid filename: ${filename}`);
            continue;
        }
        const filePath = path.join(jsDir, filename);
        if (filePath.includes('\\nul\\') || filePath.endsWith('\\nul')) {
            console.warn(`   ⚠️  Skipping invalid path: ${filePath}`);
            continue;
        }
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`   📄 Generated: ${filename}`);
    }

    const generateTime = Date.now() - startTime;
    console.log(`✅ JavaScript generated (${ast.structs.length} structs, ${ast.enums.length} enums) in ${generateTime}ms`);
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, runOneBuild, runPipeline, copyDir, printCliUsage, hasCodegenOrEmit };
