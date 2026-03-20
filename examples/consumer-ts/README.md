# TypeScript sample (parse API)

Uses `deukpack` as `file:../..` (clone DeukPack, then `npm run build` at repo root).

```bash
# repo root: npm run build
cd examples/consumer-ts
npm install
npm run parse
```

Does **not** require `examples/out`; demonstrates **AST parse** only. For generated TS types, use CLI `--js` output or future emit.
