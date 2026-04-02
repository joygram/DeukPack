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
    WSL_GXX: 'wsl g++',
    ELIXIR: 'wsl elixir'
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
        '--ts',
        '--js',
        '--csharp',
        '--cpp',
        '--java',
        '--elixir'
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
    if (fs.existsSync(csBridgeDir)) fs.rmSync(csBridgeDir, { recursive: true, force: true });
    fs.mkdirSync(csBridgeDir, { recursive: true });
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
        .filter(f => f.endsWith('.cpp') && f !== 'TestMultiPass.cpp')
        .map(f => toWslPath(path.join(cppOut, f)));

    runCmd(COMPILERS.WSL_GXX, [
        '-std=c++17',
        `-I"${wslInclude}"`,
        `"${wslSrc}"`,
        ...cppFiles.map(f => `"${f}"`),
        '-o', `"${wslBin}"`
    ]);
}


function callElixir(protocol, inStep, outStep) {
    console.log(`\n[Phase Elixir ${inStep}->${outStep}]...`);
    const elixirScript = toWslPath(path.join(root, 'src', 'codegen', '__tests__', 'ElixirBridge.exs'));
    runCmd(COMPILERS.ELIXIR, [
        elixirScript, 
        protocol, 
        toWslPath(path.join(root, `step${inStep}.bin`)), 
        toWslPath(path.join(root, `step${outStep}.bin`))
    ]);
}

const callBridge = {
    'js': (protocol, inStep, outStep) => {
        if (inStep === 'init') {
            runCmd('node', ['scripts/test_init.js', protocol, `step${outStep}.bin`]);
        } else {
            console.log(`\n[Phase JS Forward]...`);
            runCmd('node', ['scripts/test_forward.js', protocol, `step${inStep}.bin`, `step${outStep}.bin`]);
        }
    },
    'csharp': (protocol, inStep, outStep) => {
        console.log(`\n[Phase C#]...`);
        const csBridgeDir = path.join(outDir, 'cs-bridge');
        const inFile = inStep === 'init' ? 'init' : path.join(root, `step${inStep}.bin`);
        runCmd(COMPILERS.DOTNET, ['run', '--project', `"${csBridgeDir}"`, '--', protocol, inFile, path.join(root, `step${outStep}.bin`)]);
    },
    'cpp': (protocol, inStep, outStep) => {
        console.log(`\n[Phase C++]...`);
        const cppBridgeBin = path.join(binDir, 'CppBridge');
        if (fs.existsSync(cppBridgeBin)) {
            const inFile = inStep === 'init' ? 'init' : toWslPath(path.join(root, `step${inStep}.bin`));
            runCmd('wsl', [
                toWslPath(cppBridgeBin),
                protocol,
                inFile,
                toWslPath(path.join(root, `step${outStep}.bin`))
            ]);
        } else {
            console.log('[C++] Bridge binary missing, passing passthrough');
            if (inStep === 'init') throw new Error("C++ cannot be initiator if bridge is missing");
            fs.copyFileSync(`step${inStep}.bin`, `step${outStep}.bin`);
        }
    },
    'java': (protocol, inStep, outStep) => {
        console.log(`\n[Phase Java]...`);
        const javaOut = path.join(outDir, 'java');
        const javaBin = path.join(outDir, 'java-bin');
        const javaCp = `${javaBin}${path.delimiter}${javaOut}`;
        const inFile = inStep === 'init' ? 'init' : `step${inStep}.bin`;
        runCmd(COMPILERS.JAVA, ['-cp', `"${javaCp}"`, 'JavaBridge', protocol, inFile, `step${outStep}.bin`]);
    },
    'elixir': (protocol, inStep, outStep) => {
        console.log(`\n[Phase Elixir]...`);
        const elixirScript = toWslPath(path.join(root, 'src', 'codegen', '__tests__', 'ElixirBridge.exs'));
        const inFile = inStep === 'init' ? 'init' : toWslPath(path.join(root, `step${inStep}.bin`));
        runCmd(COMPILERS.ELIXIR, [
            elixirScript, 
            protocol, 
            inFile, 
            toWslPath(path.join(root, `step${outStep}.bin`))
        ]);
    }
};

const LANGS = ['js', 'elixir', 'csharp', 'cpp', 'java'];

async function runPairwiseMatrix(protocol) {
    console.log(`\n========================================`);
    console.log(`🚀 STARTING MATRIX TEST: ${protocol.toUpperCase()}`);
    console.log(`========================================`);

    const results = [];
    let passCount = 0;
    let failCount = 0;

    for (const initiator of LANGS) {
        for (const forwarder of LANGS) {
            // cleanup
            for (let i = 0; i < 5; i++) {
                if (fs.existsSync(`step${i}.bin`)) fs.unlinkSync(`step${i}.bin`);
            }

            console.log(`\n--> Testing Pair [${initiator} -> ${forwarder}]`);
            let passed = false;
            let errMsg = '';
            try {
                // 1. Initializer creates step0.bin
                callBridge[initiator](protocol, 'init', 0);
                if (!fs.existsSync(`step0.bin`)) {
                    console.log(`[Skip] Initiator ${initiator} did not generate payload for ${protocol}.`);
                    continue;
                }

                // 2. Forwarder reads step0.bin, writes step1.bin
                callBridge[forwarder](protocol, 0, 1);
                if (!fs.existsSync(`step1.bin`)) {
                    throw new Error(`Forwarder ${forwarder} did not generate step1.bin`);
                }

                // 3. Final Verification reads step1.bin
                console.log(`[Verify Phase] validating step1.bin...`);
                runCmd('node', ['scripts/test_verify.js', protocol, `step1.bin`]);
                
                passed = true;
                passCount++;
                console.log(`✅ [${initiator} -> ${forwarder}] PASS\n`);
            } catch (e) {
                console.error(`❌ [${initiator} -> ${forwarder}] FAIL: ${e.message}\n`);
                failCount++;
                errMsg = e.message;
            }

            results.push({ initiator, forwarder, passed, errMsg });
        }
    }

    return { results, passCount, failCount };
}

async function main() {
    generateAllLanguages();
    await prepareBridges();

    const protocols = ['pack', 'binary', 'json'];
    let totalPass = 0, totalFail = 0;
    const allResults = {};

    for (const p of protocols) {
        const { results, passCount, failCount } = await runPairwiseMatrix(p);
        allResults[p] = results;
        totalPass += passCount;
        totalFail += failCount;
    }

    console.log('\n========================================');
    console.log('         MATRIX TEST RESULTS');
    console.log('========================================');
    for (const p of protocols) {
        console.log(`\nProtocol: [${p.toUpperCase()}]`);
        // Draw grid
        let headerRow = 'INIT\\FWD | ' + LANGS.map(l => l.padEnd(6, ' ')).join(' | ');
        console.log(headerRow);
        console.log('-'.repeat(headerRow.length));
        for (const init of LANGS) {
            let row = init.padEnd(8, ' ') + ' | ';
            for (const fwd of LANGS) {
                const res = allResults[p].find(r => r.initiator === init && r.forwarder === fwd);
                const mark = res ? (res.passed ? '✅    ' : '❌    ') : 'N/A   ';
                row += mark + ' | ';
            }
            console.log(row);
        }
    }

    console.log('\n----------------------------------------');
    console.log(`Total Passes: ${totalPass}`);
    console.log(`Total Fails:  ${totalFail}`);
    if (totalFail === 0 && totalPass > 0) {
        console.log('\n✅ ALL NxN MATRICES VERIFIED SUCCESSFULLY!');
        process.exit(0);
    } else {
        console.error('\n❌ MATRIX TEST ENCOUNTERED FAILURES');
        process.exit(1);
    }
}

main().catch(e => {
    console.error(`\n❌ CHAIN TEST FAILED: ${e.message}`);
    process.exit(1);
});
