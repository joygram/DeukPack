const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const protocols = ['pack', 'binary', 'json'];

function run(cmd) {
    console.log(`> ${cmd}`);
    try {
        return execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
}

console.log('=== DeukPack Multi-Language Complex Roundtrip Parity Test ===');

// 1. Cleanup
if (fs.existsSync('step1.bin')) fs.unlinkSync('step1.bin');
if (fs.existsSync('step2.bin')) fs.unlinkSync('step2.bin');
if (fs.existsSync('step3.bin')) fs.unlinkSync('step3.bin');

for (const proto of protocols) {
    console.log(`\n--- Testing Protocol: ${proto.toUpperCase()} ---`);

    // Step 1: JS Init
    run(`node src/codegen/__tests__/init_complex.js ${proto} step1.bin`);

    // Step 2: Java Bridge (JS -> Java -> Binary)
    // Note: Java bridge expects 'com.deukpack.generated' classpath
    run(`java -cp dist-test/java JavaBridge ${proto} step1.bin step2.bin`);

    // Step 3: C# Bridge (Java -> C# -> Binary)
    run(`dist-test/csharp/CSharpBridge.exe ${proto} step2.bin step3.bin`);

    // Step 4: JS Verify (C# -> JS)
    run(`node src/codegen/__tests__/verify_complex.js ${proto} step3.bin`);

    console.log(`✅ ${proto.toUpperCase()} Roundtrip Success!`);
}

console.log('\n🎉 ALL PROTOCOLS PASSED PARITY TEST!');
