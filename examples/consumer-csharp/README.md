# C# consumer sample

1. Repo root: `npm run build` → `bash examples/scripts/gen-sample.sh` (or `gen-sample.cmd`).
2. `dotnet run --project examples/consumer-csharp`

References **`DeukPack.Protocol/DeukPack.Protocol.csproj`** (full `IDeukPack`, `DpProtocol`, …) and generated `examples/out/csharp/*.cs`.

For **npm-only** installs without the repo: link your game’s existing DeukPack/Thrift runtime assembly the same way — not only `dist/csharp/*.cs`.
