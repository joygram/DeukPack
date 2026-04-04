const fs = require('fs');
const path = require('path');
// JS artifacts are dynamically loaded based on model name.

function detectModelFromFilename(filename) {
    const base = path.basename(filename);
    const known = ['RoundtripModel', 'ComplexRoundtripModel', 'AddressStruct', 'TagStruct']; // known ones
    for (const model of known) {
        if (base.startsWith(model + '_') || base === model + '.bin') return model;
    }
    const idx = base.indexOf('_step');
    if (idx > 0) return base.substring(0, idx);
    return 'RoundtripModel';
}

function forward(protocol, inFile, outFile) {
    const modelName = detectModelFromFilename(inFile);
    let generated;
    try {
        generated = require(`../dist-test/js/generated_deuk`);
    } catch (e) {
        throw new Error(`Could not load JS generated code for model ${modelName}: ${e.message}`);
    }
    const {
        _schemas,
        _packStructToBinary, _structToBinary, _toDpJson,
        _packBinaryToStruct, _structFromBinary, _fromDpJson
    } = generated;

    const schema = _schemas[modelName];
    if (!schema) {
        throw new Error(`Schema not found for model: ${modelName}`);
    }

    const bytes = fs.readFileSync(inFile);
    let model;

    if (protocol === 'pack') {
        model = _packBinaryToStruct(schema, bytes, _schemas);
    } else if (protocol === 'binary') {
        model = _structFromBinary(schema, bytes, _schemas);
    } else if (protocol === 'json') {
        // JSON passthrough: parse then re-encode
        const jsonObj = JSON.parse(bytes.toString('utf8'));
        const reencoded = Buffer.from(JSON.stringify(jsonObj), 'utf8');
        fs.writeFileSync(outFile, reencoded);
        console.log(`[JS Forward] ${protocol}/${modelName}: ${inFile} -> ${outFile}`);
        return;
    } else {
        throw new Error(`Unknown protocol: ${protocol}`);
    }

    let outBytes;
    if (protocol === 'pack') {
        outBytes = _packStructToBinary(schema, model, _schemas);
    } else if (protocol === 'binary') {
        outBytes = _structToBinary(schema, model, _schemas);
    }

    fs.writeFileSync(outFile, outBytes);
    console.log(`[JS Forward] ${protocol}/${modelName}: ${inFile} -> ${outFile}`);
}

const protocol = process.argv[2] || 'binary';
const inFile   = process.argv[3] || 'RoundtripModel_step0.bin';
const outFile  = process.argv[4] || 'RoundtripModel_step1.bin';

try {
    forward(protocol, inFile, outFile);
} catch (e) {
    console.error(`[JS Forward] Error: ${e.message}`);
    process.exit(1);
}
