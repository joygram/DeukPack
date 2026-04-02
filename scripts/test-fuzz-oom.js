const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const binDir = path.join(__dirname, '..', 'dist-test', 'bin');
const outDir = path.join(__dirname, '..', 'dist-test');
const root = path.join(__dirname, '..');

const COMPILERS = {
    DOTNET: 'dotnet',
    WSL_GXX: 'wsl g++',
    JAVAC: 'javac',
    JAVA: 'java',
    ELIXIR: 'wsl elixir'
};

function toWslPath(winPath) {
    let p = winPath.replace(/\\/g, '/');
    if (p.match(/^[a-zA-Z]:/)) {
        p = `/mnt/${p[0].toLowerCase()}${p.substring(2)}`;
    }
    return p;
}

const fuzzDir = path.join(root, 'dist-test', 'fuzz');
if (!fs.existsSync(fuzzDir)) fs.mkdirSync(fuzzDir, { recursive: true });

// 1. Binary Protocol: String value length = 2GB (0x7FFFFFFF)
// Field ID 7 (String s_val)
const bin_huge_string = Buffer.from([
    0x0B, // String
    0x00, 0x07, // ID = 7
    0x7F, 0xFF, 0xFF, 0xFF, // Length = 2147483647
    0x01, 0x02 // bogus payload
]);
fs.writeFileSync(path.join(fuzzDir, 'bin_huge_string.bin'), bin_huge_string);

// 2. Binary Protocol: List count = 2GB (0x7FFFFFFF)
// Field ID 10 (List i32_list)
const bin_huge_list = Buffer.from([
    0x0F, // List
    0x00, 0x0A, // ID = 10
    0x08, // element type (i32)
    0x7F, 0xFF, 0xFF, 0xFF, // count = 2147483647
    0x00
]);
fs.writeFileSync(path.join(fuzzDir, 'bin_huge_list.bin'), bin_huge_list);

// 3. Binary Protocol: Map count = -1 (0xFFFFFFFF) -> Underflow attempt
// Field ID 12 (s_i32_map)
const bin_neg_map = Buffer.from([
    0x0D, // Map
    0x00, 0x0C, // ID = 12
    0x0B, // key (string)
    0x08, // val (i32)
    0xFF, 0xFF, 0xFF, 0xFF, // count = -1
    0x00
]);
fs.writeFileSync(path.join(fuzzDir, 'bin_neg_map.bin'), bin_neg_map);


// 4. Pack Protocol: Object length = 2GB
// Pack uses Little Endian manually for lengths!
const pack_huge_object = Buffer.from([
    0x0A, // Object tag
    0xFF, 0xFF, 0xFF, 0x7F // Length = 2147483647 in LE
]);
fs.writeFileSync(path.join(fuzzDir, 'pack_huge_object.bin'), pack_huge_object);

// 5. JSON Protocol: Array > 10MB OOM test
const json_huge_array = Buffer.from('{"lst":["' + 'A'.repeat(10 * 1024 * 1024 + 100) + '"]}');
fs.writeFileSync(path.join(fuzzDir, 'json_huge_array.json'), json_huge_array);


const BRIDGES = {
    'js': (protocol, inFile) => ({
        cmd: 'node',
        args: ['scripts/test_forward.js', protocol, inFile, path.join(fuzzDir, 'out.bin')]
    }),
    'csharp': (protocol, inFile) => ({
        cmd: COMPILERS.DOTNET,
        args: ['run', '--project', `"${path.join(outDir, 'cs-bridge')}"`, '--', protocol, inFile, path.join(fuzzDir, 'out.bin')]
    }),
    'cpp': (protocol, inFile) => ({
        cmd: 'wsl',
        args: [
            './dist-test/bin/CppBridge',
            protocol,
            path.relative(root, inFile).replace(/\\/g, '/'),
            path.relative(root, path.join(fuzzDir, 'out.bin')).replace(/\\/g, '/')
        ]
    }),
    'java': (protocol, inFile) => ({
        cmd: COMPILERS.JAVA,
        args: [
            '-cp', 
            `"${path.join(outDir, 'java-bin')};${path.join(outDir, 'java')}"`, 
            'JavaBridge', 
            protocol, 
            inFile, 
            path.join(fuzzDir, 'out.bin')
        ]
    }),
    'elixir': (protocol, inFile) => ({
        cmd: 'wsl',
        args: [
            'elixir',
            'src/codegen/__tests__/ElixirBridge.exs',
            protocol,
            path.relative(root, inFile).replace(/\\/g, '/'),
            path.relative(root, path.join(fuzzDir, 'out.bin')).replace(/\\/g, '/')
        ]
    })
};

const TESTS = [
    { name: 'Binary: Huge String', file: 'bin_huge_string.bin', protocol: 'binary' },
    { name: 'Binary: Huge List', file: 'bin_huge_list.bin', protocol: 'binary' },
    { name: 'Binary: Negative Map', file: 'bin_neg_map.bin', protocol: 'binary' },
    { name: 'Pack: Huge Object', file: 'pack_huge_object.bin', protocol: 'pack' },
    { name: 'JSON: Huge Array', file: 'json_huge_array.json', protocol: 'json' },
];

function runBridge(lang, test) {
    return new Promise((resolve) => {
        const inFile = path.join(fuzzDir, test.file);
        const bridge = BRIDGES[lang](test.protocol, inFile);
        
        let out = '';
        const isWsl = bridge.cmd === 'wsl';
        const child = spawn(bridge.cmd, bridge.args, { shell: !isWsl, cwd: root });
        
        child.stdout.on('data', d => out += d);
        child.stderr.on('data', d => out += d);

        let timeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve({ status: 'TIMEOUT', log: out });
        }, 5000);

        child.on('close', code => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ status: 'FAILED_TO_DEFEND (Exit 0)', log: out });
            } else {
                resolve({ status: 'DEFENDED (Exception/Crash)', log: out });
            }
        });
    });
}

async function runAll() {
    console.log("========================================");
    console.log("        DEUKPACK OOM FUZZING TEST");
    console.log("========================================\n");

    let allPass = true;
    for (const test of TESTS) {
        console.log(`[TEST] ${test.name}`);
        for (const lang of Object.keys(BRIDGES)) {
            if (lang === 'elixir' && test.protocol === 'pack') continue;
            if ((lang === 'js' || lang === 'elixir') && test.protocol === 'json') continue;
            
            process.stdout.write(`  ├─ ${lang.padEnd(8)}: `);
            const res = await runBridge(lang, test);
            
            if (res.status === 'DEFENDED (Exception/Crash)') {
                console.log('✅ REJECTED SAFELY');
            } else if (res.status === 'TIMEOUT') {
                console.log(`❌ HUNG/TIMEOUT! (OOM Defense Failed)`);
                allPass = false;
            } else {
                console.log(`❌ PASSED MALFORMED PAYLOAD!`);
                allPass = false;
            }
        }
        console.log("");
    }

    if (allPass) {
        console.log("✅ ALL OOM/FUZZ DEFENSES OPERATIONAL!");
        process.exit(0);
    } else {
        console.log("❌ ONE OR MORE FUZZ DEFENSES FAILED.");
        process.exit(1);
    }
}

runAll();
