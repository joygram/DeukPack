# DeukPack examples

## Sample IDL

`sample_idl/sample.thrift`: DemoPoint, DemoUser (Pack), UserRecord (Pack), UserBase/UserFull (extends).

| 파일 | 형식 | 코드젠 (`build_deukpack.js`) |
|------|------|------------------------------|
| `sample_idl/sample.thrift` | Thrift | 예 (기본 `gen-sample` 스크립트) |
| `sample_idl/sample.proto` | Protobuf | 예 (`--csharp --cpp --js` 동일) |
| OpenAPI 3.x | YAML/JSON | **아니요** — 이 저장소 `examples/`에는 샘플 없음. `scripts/build_deukpack.js` 단일 파일 모드는 `.thrift` / `.deuk` / `.proto` 파싱만 사용. OpenAPI·JSON Schema 임포트는 제품 스펙([DEUKPACK_V1_RELEASE_SCOPE.md](../docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md))에 언급되나, 별도 CLI 경로·샘플은 아직 여기에 없음. |

## Generate (from repo root)

Thrift sample (default):

```bash
bash examples/scripts/gen-sample.sh
```

Protobuf sample:

```bash
node scripts/build_deukpack.js examples/sample_idl/sample.proto examples/generated --csharp --cpp --js --protocol tbinary
```

Windows:

```bat
examples\scripts\gen-sample.cmd
```

Pipeline mode (config paths are relative to `examples/`):

```bash
node scripts/build_deukpack.js --pipeline examples/pipeline.sample.json
```

Output: `examples/generated/` (`csharp/`, `cpp/`, `js/`, and `ts/` when enabled) — ignored by git (`generated/`).

## Consumer projects

Run **gen-sample** first, then:

| Folder | Command |
|--------|---------|
| `consumer-csharp/` | `dotnet run` — Round-trip, Pack, Pack, extends 데모 |
| `consumer-cpp/` | `cmake -B build -S . && cmake --build build && ./build/demo` |
| `consumer-ts/` | `npm install && npm run parse` |
| `consumer-js/` | `npm install && npm run codegen` → `npm run demo` (pack, Pack) |

Full pipeline doc: [docs/DEUKPACK_CI_CD_AND_DEV_PIPELINE.md](../docs/DEUKPACK_CI_CD_AND_DEV_PIPELINE.md).

**득팩 키트 라인업**: 포털 [deukpack.app/starter-kits](https://deukpack.app/starter-kits/) · 정책·목록 [DEUKPACK_STARTER_KITS_LINEUP.md](../docs/DEUKPACK_STARTER_KITS_LINEUP.ko.md).

**Pack (팬아웃)**: [examples/write-with-overrides/README.md](write-with-overrides/README.ko.md) · API [DEUKPACK_WRITE_WITH_OVERRIDES_API.md](../docs/DEUKPACK_WRITE_WITH_OVERRIDES_API.md) · 사이트 튜토리얼 [deukpack.app](https://deukpack.app/tutorial/write-with-overrides/).
