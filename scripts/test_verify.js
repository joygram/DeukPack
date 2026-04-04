const fs = require('fs');
const path = require('path');
// JS artifacts are dynamically loaded based on model name.

// Re-use the same INIT_DATA definitions from test_init.js
const INIT_DATA = {
    'RoundtripModel': () => ({
        b_val: true,
        i8_val: 123,
        i16_val: 1234,
        i32_val: 123456,
        i64_val: 1234567890123456789n,
        f_val: 3.140000104904175,
        d_val: 2.718281828459,
        s_val: "DeukPack Shared World",
        bin_val: new Uint8Array([1, 2, 3, 4]),
        i32_list: [10, 20, 30],
        s_list: ["a", "b", "c"],
        s_i32_map: { "key1": 100, "key2": 200 },
        nested: { inner_val: "nested_world", numbers: [1, 1, 2, 3, 5] },
        empty_nested: { inner_val: "", numbers: [] },
        null_nested: { inner_val: "inner", numbers: [] }
    }),

    'ComplexRoundtripModel': () => ({
        b_val: false,
        i8_val: 42,
        i16_val: -1234,
        i32_val: 987654321,
        i64_val: -9223372036854775806n,
        f_val: -1.23, // JS is double anyway so precision diff is small
        d_val: 3.141592653589793,
        s_val: "Complex 안녕하세요 🌎 \x01 \n \t",
        bin_val: new Uint8Array([0, 255, 127, 128, 42]),
        i8_neg: -127,
        i16_neg: -32767,
        i32_neg: -2147483647,
        i64_neg: -9223372036854775806n,
        f_neg: -999.5,
        d_neg: -1234567890.123,
        s_empty: "",
        bin_empty: new Uint8Array(0),
        i32_zero: 0,
        i32_list: [0, 1, -1, 2147483647, -2147483647],
        i64_list: [0n, 1n, -1n, 9223372036854775806n, -9223372036854775806n],
        s_list: ["", "alpha", "beta", "gamma 🚀"],
        b_list: [true, false, true, true],
        d_list: [0.0, -0.0, 1.5, -1.5],
        i32_set: [100, 200, 300],
        s_set: ["apple", "banana", "cherry"],
        s_i32_map: { "": 0, "one": 1, "negative": -100 },
        s_d_map: { "pi": 3.141592653589793, "e": 2.718281828459045 },
        address: { city: "Seoul", country: "KR", zip_code: 12345 },
        address2: { city: "New York", country: "US", zip_code: 10001 },
        primary_tag: { key: "environment", value: "production", aliases: ["prod", "live"] },
        tags: [
            { key: "tier", value: "backend", aliases: ["server"] },
            { key: "region", value: "ap-northeast-2", aliases: ["seoul"] },
            { key: "empty", value: "", aliases: [] }
        ],
        tag_lookup: {
            "main": { key: "main_key", value: "main_val", aliases: ["m"] },
            "fallback": { key: "fb", value: "fallback", aliases: [] }
        },
        status: 2,
        opt_null_str: "not_null",
        opt_null_bin: new Uint8Array([255, 255]),
        opt_zero_i32: 999
    })
};

function detectModelFromFilename(filename) {
    const base = path.basename(filename);
    const known = Object.keys(INIT_DATA);
    for (const model of known) {
        if (base.startsWith(model + '_') || base === model + '.bin') return model;
    }
    const idx = base.indexOf('_step');
    if (idx > 0) return base.substring(0, idx);
    return 'RoundtripModel';
}

function verify(protocol, finalFile) {
    const modelName = detectModelFromFilename(finalFile);
    let generated;
    try {
        generated = require(`../dist-test/js/generated_deuk`);
    } catch (e) {
        throw new Error(`Could not load JS generated code for model ${modelName}: ${e.message}`);
    }
    const { _schemas, _packBinaryToStruct, _structFromBinary, _fromDpJson } = generated;

    const dataFactory = INIT_DATA[modelName];
    if (!dataFactory) {
        throw new Error(`No init data defined for model: ${modelName}`);
    }

    const schema = _schemas[modelName];
    if (!schema) {
        throw new Error(`Schema not found for model: ${modelName}`);
    }

    console.log(`[JS Verify] Model: ${modelName}, Protocol: ${protocol}`);

    const bytes = fs.readFileSync(finalFile);
    let model;

    try {
        if (protocol === 'pack') {
            model = _packBinaryToStruct(schema, bytes, _schemas);
        } else if (protocol === 'binary') {
            model = _structFromBinary(schema, bytes, _schemas);
        } else if (protocol === 'json') {
            const jsonObj = JSON.parse(bytes.toString('utf8'));
            model = _fromDpJson(schema, jsonObj, _schemas);
        } else {
            throw new Error(`Unknown protocol: ${protocol}`);
        }
    } catch (e) {
        console.error(`[JS Verify] Parse Error: ${e.message}`);
        process.exit(1);
    }

    const expected = dataFactory();
    const diff = compare(expected, model);

    if (diff) {
        console.error(`❌ [VERIFY FAIL] Difference at ${diff.path || 'root'}`);
        console.error(`Expected:`, diff.a);
        console.error(`Actual:`, diff.b);
        process.exit(1);
    }

    console.log(`✅ [VERIFY OK] ${finalFile} perfectly matches original IDL object.`);
}

function compare(a, b, p = '') {
    if (a === b) return null;

    if (typeof a === 'bigint' && typeof b === 'number') {
        return BigInt(b) === a ? null : { path: p, a: a.toString(), b };
    }
    if (typeof a === 'number' && typeof b === 'bigint') {
        return BigInt(a) === b ? null : { path: p, a, b: b.toString() };
    }

    const isABuf = a instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(a));
    const isBBuf = b instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(b));

    if (isABuf || isBBuf) {
        if (!a || !b) return { path: p, a, b };
        const aLen = a.length ?? a.byteLength ?? 0;
        const bLen = b.length ?? b.byteLength ?? 0;
        if (aLen !== bLen) return { path: p, aLen, bLen };
        for (let i = 0; i < aLen; i++) {
            if (a[i] !== b[i]) return { path: `${p}[${i}]`, a: a[i], b: b[i] };
        }
        return null;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return { path: p, aLen: a.length, bLen: b.length };
        for (let i = 0; i < a.length; i++) {
            const d = compare(a[i], b[i], `${p}[${i}]`);
            if (d) return d;
        }
        return null;
    }

    if (typeof a === 'object' && a !== null) {
        if (typeof b !== 'object' || b === null || b === undefined) return { path: p, a, b };
        for (const k of Object.keys(a)) {
            const d = compare(a[k], b[k], p ? `${p}.${k}` : k);
            if (d) return d;
        }
        return null;
    }

    if (typeof a === 'number' && typeof b === 'number') {
        if (Number.isNaN(a) && Number.isNaN(b)) return null;
        if (Math.abs(a - b) > 0.0001) return { path: p, a, b };
        return null;
    }

    if (a != b) return { path: p, a, b };
    return null;
}

const protocol = process.argv[2] || 'binary';
const finalFile = process.argv[3] || 'RoundtripModel_step1.bin';
verify(protocol, finalFile);
