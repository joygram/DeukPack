const { ComplexModel } = require('../../../dist-test/js/generated_deuk');
const { WireDeserializer, deukWire } = require('../../../dist/index');
const fs = require('fs');

function main() {
    const protocol = process.argv[2] || 'pack';
    const inputFile = process.argv[3] || 'final.bin';

    console.log(`[JS-Verify] Protocol: ${protocol}, Input: ${inputFile}`);

    const bytes = fs.readFileSync(inputFile);
    const deserializer = new WireDeserializer();
    const model = deserializer.deserialize(bytes, deukWire(protocol), ComplexModel);

    console.log(`[JS-Verify] level: ${model.root?.mid?.level}`);
    console.log(`[JS-Verify] name: ${model.root?.mid?.inner?.name}`);
    console.log(`[JS-Verify] leaf: ${model.root?.mid?.inner?.leaf?.value}`);

    if (model.root?.mid?.level === 99 && 
        model.root?.mid?.inner?.leaf?.value === 'Deep Leaf Value' &&
        model.root?.mid_list?.length === 1 &&
        model.mid_map?.key1?.level === 99) {
        console.log("✅ COMPLEX ROUNDTRIP SUCCESS!");
        process.exit(0);
    } else {
        console.error("❌ COMPLEX ROUNDTRIP FAILED!");
        process.exit(1);
    }
}

main();
