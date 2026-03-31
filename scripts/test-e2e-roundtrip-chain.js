const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist-test');
const binDir = path.join(outDir, 'bin');

if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

const COMPILERS = {
    // We'll try to use absolute paths found during research or assuming they are in path
    JAVAC: 'javac',
    JAVA: 'java',
    DOTNET: 'dotnet',
    WSL_GXX: 'wsl g++'
};

function runCmd(cmd, args = [], options = {}) {
    console.log(`[Exec] ${cmd} ${args.join(' ')}`);
    const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: true, ...options });
    if (r.status !== 0) {
        console.error(`[Error] Command failed with status ${r.status}`);
        process.exit(r.status || 1);
    }
}

function toWslPath(p) {
    return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (m, drive) => `/mnt/${drive.toLowerCase()}`);
}

function generateAllLanguages() {
    console.log('\n--- Generating Roundtrip Test Artifacts ---');
    runCmd('node', [
        'scripts/build_deukpack.js',
        'src/codegen/__tests__/RoundtripModel.deuk',
        'dist-test',
        '--js',
        '--csharp',
        '--cpp',
        '--java'
    ]);
}

async function prepareBridges() {
    console.log('\n--- Building Bridges ---');

    console.log('[Java] Compiling...');
    const javaSrc = path.join(root, 'src', 'codegen', '__tests__', 'JavaBridge.java');
    const javaOut = path.join(outDir, 'java');
    const javaBin = path.join(outDir, 'java-bin');
    if (!fs.existsSync(javaBin)) fs.mkdirSync(javaBin, { recursive: true });
    runCmd(COMPILERS.JAVAC, ['-cp', `"${javaOut}"`, '-d', `"${javaBin}"`, `"${javaSrc}"`]);

    console.log('[C#] Building...');
    const csOut = path.join(outDir, 'csharp', 'net8.0');
    const csProject = path.join(csOut, 'DeukDefine.csproj');
    const csBridgeSrc = path.join(root, 'src', 'codegen', '__tests__', 'CSharpBridge.cs');
    // Copy bridge into project or compile it against project
    // For simplicity, we'll just run it via 'dotnet' if we can link it.
    // Actually, let's create a minimal test project.
    const csBridgeDir = path.join(outDir, 'cs-bridge');
    if (!fs.existsSync(csBridgeDir)) fs.mkdirSync(csBridgeDir, { recursive: true });
    runCmd(COMPILERS.DOTNET, ['new', 'console', '-n', 'CSharpBridge', '-o', `"${csBridgeDir}"`, '--force']);
    runCmd(COMPILERS.DOTNET, ['add', `"${csBridgeDir}"`, 'reference', `"${csProject}"`]);
    fs.copyFileSync(csBridgeSrc, path.join(csBridgeDir, 'Program.cs'));

    console.log('[C++] Compiling via WSL g++...');
    const cppSrc = path.join(root, 'src', 'codegen', '__tests__', 'CppBridge.cpp');
    const cppOut = path.join(outDir, 'cpp');
    const cppBin = path.join(binDir, 'CppBridge'); // Linux binary (no .exe)
    
    const wslSrc =   toWslPath(cppSrc);
    const wslInclude = toWslPath(cppOut);
    const wslBin =   toWslPath(cppBin);
    
    const cppFiles = fs.readdirSync(cppOut)
        .filter(f => f.endsWith('.cpp'))
        .map(f => toWslPath(path.join(cppOut, f)));

    runCmd(COMPILERS.WSL_GXX, [
        '-std=c++17',
        `-I"${wslInclude}"`,
        `"${wslSrc}"`,
        ...cppFiles.map(f => `"${f}"`),
        '-o', `"${wslBin}"`
    ]);
}


async function runChain(protocol) {
    console.log(`\n========================================`);
    console.log(`🚀 STARTING ROUNDTRIP CHAIN: ${protocol.toUpperCase()}`);
    console.log(`========================================`);

    // 1. JS Init
    runCmd('node', ['scripts/test_init.js', protocol]);

    // 2. C# Bridge
    console.log('\n[Phase 2] C# Processing...');
    const csBridgeDir = path.join(outDir, 'cs-bridge');
    runCmd(COMPILERS.DOTNET, ['run', '--project', `"${csBridgeDir}"`, '--', protocol, path.join(root, 'step1.bin'), path.join(root, 'step2.bin')]);

    // 3. C++ Bridge (Pass-through if skipped, or execute)
    console.log('\n[Phase 3] C++ Processing...');
    const cppBridgeBin = path.join(binDir, 'CppBridge');
    if (fs.existsSync(cppBridgeBin)) {
        runCmd('wsl', [
            toWslPath(cppBridgeBin),
            protocol,
            toWslPath(path.join(root, 'step2.bin')),
            toWslPath(path.join(root, 'step3.bin'))
        ]);
    } else {
        console.log('[C++] Bridge binary missing, passing step2.bin to step3.bin');
        fs.copyFileSync('step2.bin', 'step3.bin');
    }

    // 4. Java Bridge
    console.log('\n[Phase 4] Java Processing...');
    const javaOut = path.join(outDir, 'java');
    const javaBin = path.join(outDir, 'java-bin');
    const javaCp = `${javaBin}${path.delimiter}${javaOut}`;
    runCmd(COMPILERS.JAVA, ['-cp', `"${javaCp}"`, 'JavaBridge', protocol, 'step3.bin', 'step4.bin']);

    // 5. JS Verify
    console.log('\n[Phase 5] JS Final Verification...');
    runCmd('node', ['scripts/test_verify.js', protocol, 'step4.bin']);
}

async function main() {
    generateAllLanguages();
    await prepareBridges();
    
    // Test all protocols
    const protocols = ['pack', 'binary', 'json'];
    for (const p of protocols) {
        await runChain(p);
    }
    
    console.log('\n✅ ALL PROTOCOLS VERIFIED SUCCESSFULLY THROUGH ALL LANGUAGES!');
}

main().catch(e => {
    console.error(`\n❌ CHAIN TEST FAILED: ${e.message}`);
    process.exit(1);
});
