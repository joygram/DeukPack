# DeukPack examples

## Sample IDL

| File | Format | Codegen (`build_deukpack.js`) |
|------|--------|-------------------------------|
| `sample_idl/sample.thrift` | Thrift | Yes (default `gen-sample` script) |
| `sample_idl/sample.proto` | Protobuf | Yes (`--csharp --cpp --js`) |

## Generate (from repo root)

Thrift sample (default):

```bash
bash examples/scripts/gen-sample.sh
```

Protobuf sample:

```bash
node scripts/build_deukpack.js examples/sample_idl/sample.proto examples/out --csharp --cpp --js --protocol binary
```

Windows:

```bat
examples\scripts\gen-sample.cmd
```

Pipeline mode (config paths are relative to `examples/`):

```bash
node scripts/build_deukpack.js --pipeline examples/pipeline.sample.json
```

Output: `examples/out/` (`csharp/`, `cpp/`, `javascript/`) — ignored by git (`out/`).

## Consumer projects

Run **gen-sample** first, then:

| Folder | Command |
|--------|---------|
| `consumer-csharp/` | `dotnet run` |
| `consumer-cpp/` | `cmake -B build -S . && cmake --build build && ./build/demo` |
| `consumer-ts/` | `npm install && npm run parse` |
| `consumer-js/` | `npm install && npm run codegen` |

**Starter kits**: [deukpack.app/starter-kits](https://deukpack.app/starter-kits/)
