const { ComplexModel, RootRecord, MidRecord, InnerRecord, LeafRecord } = require('../../../dist-test/js/generated_deuk');
const { WireSerializer, deukWire } = require('../../../dist/index');
const fs = require('fs');

function main() {
    const protocol = process.argv[2] || 'pack';
    const outputFile = process.argv[3] || 'step1.bin';

    console.log(`[JS] Protocol: ${protocol}, Output: ${outputFile}`);

    const model = new ComplexModel();
    model.root = new RootRecord();
    model.root.mid = new MidRecord();
    model.root.mid.level = 99;
    model.root.mid.inner = new InnerRecord();
    model.root.mid.inner.name = "Level 1";
    model.root.mid.inner.leaf = new LeafRecord();
    model.root.mid.inner.leaf.value = "Deep Leaf Value";

    model.root.mid_list = [
        (() => {
            const m = new MidRecord();
            m.level = 100;
            m.inner = new InnerRecord();
            m.inner.name = "List Item 1";
            return m;
        })()
    ];

    model.mid_map = {
        "key1": model.root.mid
    };
    model.extra_data = Buffer.from("Extra Binary Data");

    const serializer = new WireSerializer();
    const bytes = serializer.serialize(model, deukWire(protocol));
    fs.writeFileSync(outputFile, bytes);

    console.log(`[JS] Successfully wrote ${outputFile} (${bytes.length} bytes)`);
}

main();
