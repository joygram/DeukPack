const fs = require('fs');
const path = require('path');
const { _schemas, _packStructToBinary, _structToBinary, _toDpJson } = require('../dist-test/js/generated_deuk');

function init(protocol) {
    const model = {
        b_val: true,
        i8_val: 123,
        i16_val: 1234,
        i32_val: 123456,
        i64_val: 1234567890123456789n,
        f_val: 3.140000104904175, // Float precision
        d_val: 2.718281828459,
        s_val: "DeukPack Shared World",
        bin_val: new Uint8Array([1, 2, 3, 4]),
        i32_list: [10, 20, 30],
        s_list: ["a", "b", "c"],
        s_i32_map: { "key1": 100, "key2": 200 },
        nested: {
            inner_val: "nested_world",
            numbers: [1, 1, 2, 3, 5]
        }
    };

    const schema = _schemas["RoundtripModel"];
    let bytes;

    if (protocol === 'pack') {
        bytes = _packStructToBinary(schema, model, _schemas);
    } else if (protocol === 'binary') {
        bytes = _structToBinary(schema, model, _schemas);
    } else if (protocol === 'json') {
        const jsonObj = _toDpJson(schema, model, _schemas);
        bytes = Buffer.from(JSON.stringify(jsonObj), 'utf8');
    } else {
        throw new Error(`Unknown protocol: ${protocol}`);
    }

    fs.writeFileSync('step1.bin', bytes);
    console.log(`[JS] Initiated ${protocol} to step1.bin (Size: ${bytes.length} bytes)`);
}

const protocol = process.argv[2] || 'pack';
try {
    init(protocol);
} catch (e) {
    console.error(`[JS] Init Error: ${e.message}`);
    process.exit(1);
}
