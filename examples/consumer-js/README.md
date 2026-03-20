# JavaScript sample (call codegen from Node)

Runs the same CLI as CI: `node scripts/build_deukpack.js … --js`.

```bash
cd examples/consumer-js
npm install
npm run codegen
npm run demo
```

- **codegen**: generates `examples/out/javascript/generated.js` (meta/editor-oriented bundle).
- **demo**: runs WriteWithOverrides, toJsonWithFields, projectFields against generated code (requires codegen first).
