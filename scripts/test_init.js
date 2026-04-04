const fs = require('fs');
const path = require('path');
// JS artifacts are dynamically loaded based on model name.

// ─────────────────────────────────────────
// 모델별 초기 데이터 제공자
// ─────────────────────────────────────────
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
    
    'ComplexRoundtripModel': () => {
        // IDL의 ComplexRoundtripModel 구조에 맞춘 완전한 테스트 데이터 모음
        return {
            b_val: false,
            i8_val: 42,
            i16_val: -1234,
            i32_val: 987654321,
            i64_val: -9223372036854775806n, // 근원 경계값으로
            f_val: -1.23,
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
            
            i32_set: [100, 200, 300], // DeukPack JS에서 set은 배열로 넘어옴
            s_set: ["apple", "banana", "cherry"],
            
            s_i32_map: {
                "": 0,
                "one": 1,
                "negative": -100
            },
            s_d_map: {
                "pi": 3.141592653589793,
                "e": 2.718281828459045
            },
            
            address: {
                city: "Seoul",
                country: "KR",
                zip_code: 12345
            },
            address2: {
                city: "New York",
                country: "US",
                zip_code: 10001
            },
            primary_tag: {
                key: "environment",
                value: "production",
                aliases: ["prod", "live"]
            },
            tags: [
                { key: "tier", value: "backend", aliases: ["server"] },
                { key: "region", value: "ap-northeast-2", aliases: ["seoul"] },
                { key: "empty", value: "", aliases: [] }
            ],
            tag_lookup: {
                "main": { key: "main_key", value: "main_val", aliases: ["m"] },
                "fallback": { key: "fb", value: "fallback", aliases: [] }
            },
            
            status: 2, // Inactive
            
            opt_null_str: "not_null",
            opt_null_bin: new Uint8Array([255, 255]),
            opt_zero_i32: 999
        };
    }
};

function detectModelFromFilename(filename) {
    const base = path.basename(filename);
    const known = Object.keys(INIT_DATA);
    for (const model of known) {
        if (base.startsWith(model + '_') || base === model + '.bin') return model;
    }
    const underscoreIdx = base.indexOf('_step');
    if (underscoreIdx > 0) return base.substring(0, underscoreIdx);
    return 'RoundtripModel';
}

function init(protocol, outFile) {
    const modelName = detectModelFromFilename(outFile);
    const dataFactory = INIT_DATA[modelName];

    if (!dataFactory) {
        throw new Error(`No init data defined for model: ${modelName}`);
    }

    let generated;
    try {
        generated = require(`../dist-test/js/generated_deuk`);
    } catch (e) {
        throw new Error(`Could not load JS generated code for model ${modelName}: ${e.message}`);
    }
    const { _schemas, _packStructToBinary, _structToBinary, _toDpJson } = generated;

    const schema = _schemas[modelName];
    if (!schema) {
        throw new Error(`Schema not found for model: ${modelName}. Available: ${Object.keys(_schemas).join(', ')}`);
    }

    const model = dataFactory();
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

    fs.writeFileSync(outFile, bytes);
    console.log(`[JS] Initiated ${protocol}/${modelName} to ${outFile} (Size: ${bytes.length} bytes)`);
}

const protocol = process.argv[2] || 'binary';
const outFile = process.argv[3] || 'RoundtripModel_step0.bin';
try {
    init(protocol, outFile);
} catch (e) {
    console.error(`[JS] Init Error: ${e.message}`);
    process.exit(1);
}
