const fs = require('fs');
const { _schemas } = require('../dist-test/js/generated_deuk');

function createSampleModel() {
    return {
        b_val: true,
        i8_val: 10,
        i16_val: 20,
        i32_val: 100,
        i64_val: 1000n,
        f_val: 1.1,
        d_val: 2.2,
        s_val: "Original String",
        bin_val: new Uint8Array([0xAA, 0xBB]),
        i32_list: [1, 2, 3],
        s_list: ["A", "B"],
        s_i32_map: { "Key1": 1 },
        nested: { inner_val: "Inner", numbers: [9] },
        empty_nested: { inner_val: "", numbers: [] },
        null_nested: { inner_val: "inner", numbers: [] }
    };
}

// 1. 얕은 복사/참조 전달 시뮬레이션
function mutateAndPass(obj, maxIterations) {
    let current = obj;
    for (let i = 0; i < maxIterations; i++) {
        current.i32_val += 1;
        // Mocking a middleware handler passage
        current = (function passMiddleware(target) { return target; })(current);
    }
    return current;
}

function runMultiPassTest() {
    console.log("🚀 Starting JS In-Memory Multi-Pass Routing Simulation...");
    
    const original = createSampleModel();
    // 깊은 복사가 없는 단순 구조체 라우팅
    const result = mutateAndPass(original, 1000000); // 1 Million Passes
    
    // 무결성 체킹: 1,000,000번 통과하며 변형된 값이 
    // 동일 참조를 유지하고 반영되었는지 확인.
    if (result.i32_val !== 1000100) {
         throw new Error("❌ Validation Failed: i32_val mismatch after 10000 passes.");
    }
    
    // 문자열 등 참조 타입이 깨지지 않고 유지되었는지 확인 (GC 방어)
    if (result.s_val !== "Original String" || result.nested.inner_val !== "Inner") {
         throw new Error("❌ Validation Failed: Reference strings corrupted after multiple stack frames.");
    }
    
    console.log(`✅ [JS] Multi-Pass Simulation Passed (10,000 passes). Final i32_val = ${result.i32_val}`);
}

try {
    runMultiPassTest();
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
