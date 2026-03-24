# C# consumer sample

1. Repo root: `npm run build` → `bash examples/scripts/gen-sample.sh` (or `gen-sample.cmd`).
2. `dotnet run --project examples/consumer-csharp`

References **`DeukPack.Protocol/DeukPack.Protocol.csproj`** (full `IDeukPack`, `DpProtocol`, …) and generated `examples/out/csharp/*.cs`.

For **npm-only** installs without the repo: link your game’s existing DeukPack/Thrift runtime assembly the same way — not only `dist/csharp/*.cs`.

**WriteWithOverrides**: After codegen, `tutorial.DemoUser` includes `WriteWithOverrides(oprot, overrides)` — use field IDs **1** = id, **2** = name, **3** = home. See [examples/write-with-overrides/README.md](../write-with-overrides/README.md) and the [site tutorial](https://deukpack.app/en/tutorial/write-with-overrides/).
