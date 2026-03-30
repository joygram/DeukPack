const fs = require('fs');
const path = require('path');
const { _schemas, _packBinaryToStruct, _structFromBinary, _fromDpJson } = require('../dist-test/js/generated_deuk');

function verify(protocol, finalFile) {
    const finalData = fs.readFileSync(finalFile);
    const schema = _schemas["RoundtripModel"];
    let finalModel;

    if (protocol === 'pack') {
        finalModel = _packBinaryToStruct(schema, finalData, _schemas);
    } else if (protocol === 'binary') {
        finalModel = _structFromBinary(schema, finalData, _schemas);
    } else if (protocol === 'json') {
        const jsonObj = JSON.parse(finalData.toString('utf8'));
        finalModel = _fromDpJson(schema, jsonObj, _schemas);
    } else {
        throw new Error(`Unknown protocol: ${protocol}`);
    }

    const initialModel = {
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
        nested: {
            inner_val: "nested_world",
            numbers: [1, 1, 2, 3, 5]
        }
    };

    // Deep comparison
    const diff = compare(initialModel, finalModel);
    if (diff) {
        console.error(`[Verify] Failed! Differences found: \n${JSON.stringify(diff, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}`);
        process.exit(1);
    } else {
        console.log(`[Verify] Protocol ${protocol}: PASSED (Data Integrity Confirmed)`);
    }
}

function compare(a, b, path = '') {
    if (a === b) return null;
    
    // BigInt and Number comparison (standard strict in tests)
    if (typeof a === 'bigint' && typeof b === 'number') {
        if (BigInt(b) === a) return null;
        return { path, a, b };
    }
    if (typeof a === 'number' && typeof b === 'bigint') {
        if (BigInt(a) === b) return null;
        return { path, a, b };
    }

    if (typeof a !== typeof b) {
        // Handle Buffer vs Uint8Array (Node.js vs Browser/Standard)
        const isA_Buf = (a instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(a)));
        const isB_Buf = (b instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(b)));
        if (isA_Buf && isB_Buf) {
            // Both are binary-like, proceed to length/byte comparison
        } else {
            return { path, aType: typeof a, bType: typeof b, a, b };
        }
    }

    if (a instanceof Uint8Array || b instanceof Uint8Array || (typeof Buffer !== "undefined" && (Buffer.isBuffer(a) || Buffer.isBuffer(b)))) {
        if (!a || !b) return { path, a, b };
        const aLen = a.length !== undefined ? a.length : (a.byteLength !== undefined ? a.byteLength : 0);
        const bLen = b.length !== undefined ? b.length : (b.byteLength !== undefined ? b.byteLength : 0);
        if (aLen !== bLen) return { path, aLen, bLen };
        for (let i = 0; i < aLen; i++) if (a[i] !== b[i]) return { path: `${path}[${i}]`, a: a[i], b: b[i] };
        return null;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        // We only care about keys in A
        for (const k of keysA) {
            const d = compare(a[k], b[k], path ? `${path}.${k}` : k);
            if (d) return d;
        }
        return null;
    }
    // Float comparison with tolerance
    if (typeof a === 'number' && typeof b === 'number') {
        if (Math.abs(a - b) > 0.0001) return { path, a, b };
        return null;
    }
    if (a != b) return { path, a, b };
    return null;
}

const protocol = process.argv[2] || 'pack';
const finalFile = process.argv[3] || 'step4.bin';
verify(protocol, finalFile);
