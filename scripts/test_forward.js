const fs = require('fs');
const path = require('path');
const { _schemas, _packStructToBinary, _structToBinary, _structFromBinary, _packBinaryToStruct } = require('../dist-test/js/generated_deuk');

function forward(protocol, inFile, outFile) {
    const bytes = fs.readFileSync(inFile);
    const schema = _schemas["RoundtripModel"];
    
    let model;
    if (protocol === 'pack') {
        model = _packBinaryToStruct(schema, bytes, _schemas);
    } else if (protocol === 'binary') {
        model = _structFromBinary(schema, bytes, _schemas);
    } else if (protocol === 'json') {
        const jsonObj = JSON.parse(bytes.toString('utf8'));
        // We reuse the verify approach for JSON decoding dynamically or we just assume JS object maps cleanly
        // for simplicity here we assume the JSON stringify/parse works for forwarding
        const reencoded = Buffer.from(JSON.stringify(jsonObj), 'utf8');
        fs.writeFileSync(outFile, reencoded);
        console.log(`[JS Forward] ${protocol}: forwarded ${inFile} to ${outFile}`);
        return;
    }

    let outBytes;
    if (protocol === 'pack') {
        outBytes = _packStructToBinary(schema, model, _schemas);
    } else if (protocol === 'binary') {
        outBytes = _structToBinary(schema, model, _schemas);
    }

    fs.writeFileSync(outFile, outBytes);
    console.log(`[JS Forward] ${protocol}: forwarded ${inFile} to ${outFile}`);
}

const protocol = process.argv[2] || 'pack';
const inFile = process.argv[3] || 'step7.bin';
const outFile = process.argv[4] || 'step8.bin';

try {
    forward(protocol, inFile, outFile);
} catch (e) {
    console.error(`[JS Forward] Error: ${e.message}`);
    process.exit(1);
}
