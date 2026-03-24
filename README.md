# DeukPack

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)

**Languages / 언어:** [English](README.md) · [한국어](README.ko.md)

**DeukPack** — one toolchain for specs, code, and data.  
**Native `.deuk` IDL** plus **Protobuf, OpenAPI, JSON Schema, CSV**, and **legacy `.thrift`** in a **single fast pipeline** → **C#, C++, JavaScript**, registries, and **network-ready message layouts**.

---

## At a glance

| | What you get |
|---|----------------|
| **Interop** | **Protobuf-style / Binary·Compact** wire first; optional coexistence with legacy stacks. |
| **Inputs** | **`.deuk` first-class**; **`.proto`, `.thrift`, OpenAPI, JSON Schema, CSV** in the **same build**. |
| **Speed** | **Parse & codegen orders of magnitude faster** than typical single-tool IDL workflows at scale. |
| **Integration** | One AST → **multi-language outputs**, **SQLite DDL**, **schema JSON**, **IDL-driven registries**. |
| **Agents** | **Deterministic** codegen — specs in, typed code out. [AI pipeline →](https://deukpack.app/en/ai-pipeline-integration/) |
| **Extensibility** | **CLI + pluggable generators** (C#, C++, TS, JS). |
| **Extended types (vs Protobuf/Thrift)** | **One line:** `int8`–`int64`, `uint8`–`uint64`, `float`/`double`, `bool`, `string`/`binary`, `list`/`set`/`map`, **tablelink**, `datetime`/`decimal`, **struct extends** — [Reference](https://deukpack.app/en/reference/api/) for full list and semantics. |

---

## Why DeukPack

### 1. Compatibility & legacy migration

- **One engine, many inputs**: **`.deuk`** alongside `.proto`, `.thrift`, OpenAPI — same AST, same codegen rules.
- **Wire profiles**: **Protobuf-aligned** Binary/Compact first; coexistence with legacy services where needed.
- **Structural CSV import** — treat wide or headered CSV as schema input where it fits your migration story.
- **OpenAPI 3.x & JSON Schema** — REST-era contracts feed the same codegen and validation story.

### 2. Performance where it hurts

| Area | Typical gain |
|------|-------------------------------------|
| Parse + codegen (many files) | **~25–50×** faster |
| TS / JS emit | **~15–30×** faster |
| Runtime serialize / deserialize | **~10×** faster |

*Details: [protocol & serialization guide](https://deukpack.app/en/tutorial/protocol-serialization/).*

### 3. Integration, not fragmentation

- **Single source of truth** → **C#, C++, TypeScript, JavaScript** types and serializers together.
- **Registries & protocol helpers** from IDL — message / handler wiring (e.g. msgId-style dispatch).
- **Multiple wire styles** — **Binary**, **Compact**, **JSON** bridging.
- **SQLite** path from schema for local / embedded structured storage.

### 4. Built for AI & agent workflows

- Agents produce or refine **OpenAPI, `.deuk`, `.proto`, or `.thrift`**; DeukPack turns them into **repeatable, reviewable code**.
- **CLI** for scripts, CI, or orchestration — same as an agent invoking a compiler.

→ [AI pipeline integration](https://deukpack.app/en/ai-pipeline-integration/) · [AI IDE tools guide](https://deukpack.app/en/ai-ide-tools-guide/)

### 5. Major languages, one IDL story

| Output | Role |
|--------|------|
| **C#** | .NET / Unity / servers — full runtime types, `GetSchema()`, protocol helpers. [C# guide →](https://deukpack.app/en/tutorial/csharp-guide/) |
| **C++** | Native services, performance-critical paths. [C++ guide →](https://deukpack.app/en/tutorial/cpp-guide/) |
| **TypeScript / JavaScript** | BFFs, tools, editors, Node pipelines. |

### 6. API & generator extension

- **Engine API** for parse → AST → emit. [API reference →](https://deukpack.app/en/reference/api/)
- **Code generators** as extension points — add languages or corporate templates.
- **`deukpack` CLI** for zero-code integration in CI (`npx deukpack …`).

---

## Installation

[Install guide (Windows / Linux)](https://deukpack.app/en/tutorial/install-os/) · [Distribution vs source](https://deukpack.app/en/tutorial/distribution-vs-source/)

```bash
npm install deukpack
# or from GitHub Release tarball
npm install ./deukpack-x.y.z.tgz
```

Global CLI:

```bash
npm i -g deukpack
deukpack --help
```

---

## Quick usage (CLI)

```bash
npx deukpack ./schema.deuk ./out --csharp --cpp

npx deukpack ./api.deuk ./gen -I ./includes --csharp --protocol tbinary

npx deukpack --pipeline ./deukpack-pipeline.json
```

**Guides:** [Quick start](https://deukpack.app/en/tutorial/quickstart/) · [IDL guide](https://deukpack.app/en/tutorial/idl-guide/) · [C#](https://deukpack.app/en/tutorial/csharp-guide/) · [C++](https://deukpack.app/en/tutorial/cpp-guide/) · [Pipeline](https://deukpack.app/en/tutorial/pipeline-guide/)  
**Reference:** [API & types](https://deukpack.app/en/reference/api/) · [Protocol & serialization](https://deukpack.app/en/tutorial/protocol-serialization/)

---

## Documentation

| | |
|--|--|
| **Tutorials** | [deukpack.app/tutorial](https://deukpack.app/en/tutorial/) |
| **API reference** | [deukpack.app/reference/api](https://deukpack.app/en/reference/api/) |
| **Products** | [deukpack.app/products](https://deukpack.app/en/products/) |
| **Protocol** | [Protocol](https://deukpack.app/en/products/protocol/) · [Serialization guide](https://deukpack.app/en/tutorial/protocol-serialization/) |
| **AI pipeline** | [AI integration](https://deukpack.app/en/ai-pipeline-integration/) · [AI IDE tools](https://deukpack.app/en/ai-ide-tools-guide/) |
| **Kits lineup** | [deukpack.app/starter-kits](https://deukpack.app/en/starter-kits/) |
| **License** | [deukpack.app/license](https://deukpack.app/en/license/) |

**Site:** [deukpack.app](https://deukpack.app/en/) · **Contact:** contact@deukpack.app

---

## Development

```bash
npm ci
npm run build
npm test
npm run benchmark   # optional
```

---

## Support development

DeukPack is **free and Apache-2.0**. If it helps your team, consider supporting continued development:

- **PayPal**: **Send** → **`joygram@gmail.com`**
- **Ko-fi**: [Support via Ko-fi](https://ko-fi.com/joygram)

Not in a position to donate? **Star the repo**, **open issues**, **send PRs**, or **spread the word**.

---

## Contributing

1. Fork → feature branch → PR.
2. See [RELEASING.md](RELEASING.md) for tag & release conventions.

---

## License

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE).
