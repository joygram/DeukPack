# DeukPack: AI-Native Universal Schema Multi-hub

> **Universal Schema Multi-hub for Protobuf, Thrift, OpenAPI, and .deuk. (High-Performance)**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![npm downloads](https://img.shields.io/npm/dm/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![GitHub stars](https://img.shields.io/github/stars/joygram/DeukPack.svg?style=social)](https://github.com/joygram/DeukPack/stargazers)

**Languages / 언어:** [English](README.md) · [한국어](README.ko.md)

**The AI Breakthrough:** Turn **Mixed-IDL definitions** (Protobuf, OpenAPI, JSON Schema, CSV, and legacy `.thrift`) into **deterministic, type-safe C#, C++, TypeScript, and JavaScript** with **AI Semantic Mapping**, **MCP Server Auto-Generation**, and **Zod-based Guardrails**.

### 🚀 Quick Start
```bash
npx deukpack init
```

---

**Start here — pick one path**

- **Ship it in your repo:** local install in the project root — **[Installation](#installation)** · **[Installation & tutorials](https://deukpack.app/tutorial/)**.
- **Read the manual:** **[deukpack.app](https://deukpack.app/)** — overview, protocol, **[API reference](https://deukpack.app/reference/api/)**.
- **Run a lab in a folder (🚧 Sealed - Coming Soon):** **[Hands-on from zero](https://kits.deukpack.app/starter-course/hands-on/)**; optional **[DeukPack Chronicle](https://kits.deukpack.app/journey/)** or *[Ruins](https://kits.deukpack.app/starter-course/)* for story-first onboarding.

**Sites and doc roles** are summarized in **[Documentation & links](#documentation--links)** below.

**npm / OSS public scope (v1 product line):** **IDL → multi-language codegen, CLI**, Binary/Compact/JSON wire. **Excel protocol and Excel add-in are distributed separately** — not part of core npm. **Scope & product line (maintainers):** [DEUKPACK_V1_RELEASE_SCOPE.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md) · overview **[deukpack.app](https://deukpack.app/)**.

**Versions:** **Published** = `version` in [`package.json`](package.json) and the **npm badge** above. **1.0.x ↔ 1.1.0 ↔ 1.2.x** (and later) deltas: [CHANGELOG.md](CHANGELOG.md) (EN) · [CHANGELOG.ko.md](CHANGELOG.ko.md) (KO) · [DEUKPACK_V1_RELEASE_SCOPE.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md) §0 / §0.1 — **DeukPackKits StarterKit** prologue codegen checks are noted in the changelog.

---

## Why DeukPack: The AI-Ready Advantage

### 1. Universal IDL Gateway (OpenAPI, JSON Schema, Protobuf, Thrift, CSV)
Modern systems often struggle with a fragmented mix of Specs—legacy (Thrift), modern (Protobuf/gRPC), and web-native (OpenAPI/JSON Schema). This fragmentation creates a massive "context gap" for both developers and AI.
- **Universal IDL Gateway:** You don't have to convert your existing `.proto` or `.thrift` files. DeukPack aggregates diverse IDL sources into a single source of truth. *(Note: Protobuf support is currently in preview; advanced features like nested messages and oneof are under development.)*
- **DeukPack Solution:** It acts as a **Single Source of Truth** that aggregates diverse IDL sources into one unified, semantic model. It's not just a converter; it's a bridge that maps types into a deterministic SDK while remaining **wire-compatible with your legacy protocols**.

### 2. IDL-to-AI Semantic Mapping
Go beyond basic data types. DeukPack extracts metadata from your IDL comments (`/** ... */`) and field structures, transforming them into a **'Semantic Context'** that AI can instantly grasp.
- **Breakthrough:** Designers evolve from simple coders into high-level architects defining **data lineage** via a machine-readable semantic layer.

### 3. AI-Native Execution Bridge (MCP Plugin Support)
Existing IDL tools generate static code. DeukPack generates a **runtime execution bridge** that allows AI agents to interact with the world.
- **Plugin-based Expansion:** The **Model Context Protocol (MCP)** server auto-generation feature has been decoupled into a standalone plugin (`DeukPackMcp`) for better core modularity. AI agents (Cursor, Claude, etc.) can now leverage the **Intelligent Context** extracted from the core to browse live documentation and execute backend methods via the plugin.

### 4. Zero-Allocation High Performance (Bottleneck-Free)
DeukPack is engineered for extreme efficiency. Whether parsing 500+ IDL files or serializing massive objects, it remains **orders of magnitude faster** than classic industry flows. See raw numbers in the [Performance](#-performance-the-zero-bottleneck-foundation) section below.

---

## 🚀 Release Roadmap

DeukPack increments the **Minor** version for each new language or platform support. We are currently expanding the ecosystem through the **v1.5.x series**.

| Version | Key Milestones | Status |
| :--- | :--- | :--- |
| **v1.4.0** | MCP Protobuf expansion, C#/C++/JS core runtime stabilization | **DONE** |
| **v1.5.0** | **Java & Core Parity**: Inheritance support, Compact/TJSON protocols, Universal security guards, and **MCP Core Decoupling** | **DONE** |
| **v1.5.1** | **C++ Zero-Alloc Optimization**: Arena allocator for wire serialization, **C++ DDL Generator** (MySQL, PostgreSQL, SQLite) | **DONE** |
| **v1.6.0** | **V8 JIT Codegen & Zero-Alloc Architecture**: Ultimate JS/C# memory optimizations and benchmark matrix | **DONE** |
| **v1.7.0** | **Elixir Engine Support**: Native Erlang BEAM pattern matching & **Universal Protocol Security Shield** | **Current** |

---

## ⚡ Performance: The Zero-Bottleneck Foundation

DeukPack goes beyond simple speed; it aims to be a **"No-Latency Intelligent Core"** that doesn't bottleneck even when an AI agent processes tens of thousands of lines of IDL knowledge in real-time. It achieves an average **60–100% reduction in memory allocation** and a **250% increase in JS parsing speed** compared to commercially available formats.

👉 **[View the Performance Summary and Detailed Comparison Table](#performance-goals-scale--efficiency)**

---

### Versioning Policy

- **Minor (0.X.0)**: **New language support**, **New platform output**, or major feature expansion.
- **Patch (0.0.X)**: Bug fixes, performance optimizations, and minor improvements.

---

## Feature Matrix

Current support status and plans for each target platform.

| Category | Feature | TS / JS | C# / Unity | C++ | Java | Elixir |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **IDL Core** | Basic Types / Aliases | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inheritance** | `extends` support | ✅ | ✅ | ✅ | ✅ (v1.5) | ✅ |
| **Protocols** | Native Pack (.dpk) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Protobuf Compatible | ✅ | ✅ | 🚧 (v1.4) | ✅ | - |
| | Thrift Compatible (T-Series) | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| | JSON (Tagged / POJO) | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| | YAML / CSV | ✅ | ✅ (v1.2.7) | 🚧 | 🚧 | - |
| **Optimizations**| Zero-Alloc Parsing / JIT | ✅ (v1.6) | ✅ | ✅ (v1.4.2) | 🚧 | ✅ (BEAM) |
| | `Write` Logic Overrides | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| **Data/Meta** | `tablelink` / MetaTable | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| | DB Interop (EF / SQL) | ⚠️ (1) | ⚠️ (2) | ⚠️ (3) | 🚧 (v1.5) | - |
| **AI Agent & IDE Integration** | Tool Auto-Generation (Skill) | ✅ (v1.5 MCP Decoupled) | 🚧 | - | - | - |
| | Intelligent Context (Knowledge) | ✅ (Core Ready) | ✅ | ✅ | ✅ | ✅ |
| | IDE Encoder/Intelllsense | ✅ | ✅ | ✅ | ✅ | ✅ |

- ✅: Full Support / Production Ready
- ⚠️: Preview / Partial Support or Constraints
- 🚧: Pilot / Development in Progress
- -: Not Currently Supported

> [!CAUTION]
> **Database Integration (⚠️) Detailed Constraints:**
> 1. **TS / JS**: Primarily JSON/Binary serialization-based storage. Relational mapping is limited (Blob-centric).
> 2. **C# (EF Core)**: Supports table generation via `entity` keyword. However, **Nested Collections (List/Map/Set)** are NOT automatically mapped to SQL columns (requires Blob storage or manual Converter).
> 3. **C++**: Primarily DDL (SQL) generation. Runtime ORM integration is not provided.
> 4. **Common**: DB Migration (change management) logic for schema structural changes is not provided.

### Language-Specific Highlights

*   **C# (.NET / Unity)**: Features **Zero-Allocation** parsing for game client performance, **EF Core** integration (see constraints), **MetaTable Registry**, and **YAML protocol**(v1.2.7) for IDL-driven configuration management.
*   **TypeScript / JSON**: Native **Model Context Protocol (MCP)** plugin support and Intelligent Context extraction, seamless **POJO** wire mapping, and decoupled **DeukPackMcp** hub for execution bridging (v1.5.0).
*   **C++**: Engineered for **low-latency** and **embedded** scenarios, focused on Binary/Compact and JSON protocol compatibility (stabilized in v1.5.0) with minimal memory footprint.
*   **Java**: Robust cross-platform interoperability with full support for **Inheritance (extends)** and **Thrift-compatible** Compact/TJSON protocols, achieving full parity in v1.5.0.

---

## Installation

Tutorials and OS-specific notes: **[deukpack.app/tutorial](https://deukpack.app/tutorial/)**.

Use a **local install in the project root** (version pinned per repo). This guide does **not** cover **`npm install -g deukpack`**.

At the project root:

```bash
npm install deukpack
npx deukpack init
npx deukpack run         # default: ./deukpack.pipeline.json
```

**CLI note:** **`npx deukpack …`** runs the **`deukpack`** binary from this project’s **`node_modules/.bin`** (same idea as **`npm exec deukpack -- …`**). **`npm deukpack`** is not a valid npm subcommand—use **`npx`** or an npm script that calls **`deukpack`**.

If you want an explicit `package.json` before any dependency (optional): `npm init -y` then `npm install deukpack`. Otherwise `npm install deukpack` alone is enough — current npm creates or updates `package.json` when needed.

**`npx deukpack init`** writes **`deukpack.pipeline.json`**, runs **bootstrap** so **`.deukpack/workspace.json`** is created or refreshed (Unity/project discovery; default **`installKind`** is **`package`** unless you pass **`--kind src`** with **`--engine-root`**), then **attempts** to install the bundled editor VSIX last (**`bundled/deuk-idl.vsix`** for **VS Code** (`code`), **Cursor** (`cursor`), or **Antigravity** (`antigravity`) on `PATH`; no prompt—use **`--skip-vsix`** to skip). VSIX path and manual install: [`bundled/README.md`](bundled/README.md).

From a GitHub Release tarball:

```bash
npm install ./deukpack-x.y.z.tgz
```

**`npm install deukpack` postinstall** suggests **`npx deukpack init`** when neither **`deukpack.pipeline.json`** nor **`.deukpack/workspace.json`** exists.

Ad-hoc **`npx deukpack <entry.deuk> <outDir> …`** still runs without a pipeline file; if **`deukpack.pipeline.json`** is missing in the current working directory, the CLI **warns** and points you at **`npx deukpack init`**.

---

## Documentation & links

| | |
|--|--|
| **This README** | Clone-time summary |
| **Feature overview (clone)** | [DEUKPACK_FEATURES.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_FEATURES.md) · [KO](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_FEATURES.ko.md) |
| **[deukpack.app](https://deukpack.app/)** | Install, tutorials, protocol, [API reference](https://deukpack.app/reference/api/) |
| **[kits.deukpack.app](https://kits.deukpack.app/)** | 🚧 Sealed — Coming Soon |
| **Kits lineup** | [deukpack.app/starter-kits](https://deukpack.app/starter-kits/) |
| **Korean README** | [README.ko.md](README.ko.md) |
| **Releases** | [RELEASING.md](RELEASING.md) |
| **Full clone doc index** | [docs/README.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/README.ko.md) (not in npm tarball) |

**Contact:** contact@deukpack.app

---

## Performance Goals (Scale & Efficiency)

DeukPack is designed for **extreme scalability** and **low-latency engineering**. Our focus is to eliminate the bottlenecks of legacy IDL-style compilers while maintaining full protocol compatibility.

- **Fast TS/C# Generation**: Optimized Zero-Allocation code emission designed for rapid CI/CD cycles and local hot-reloading.
- **Efficient Binary Formats**: Implements high-performance packing (DPK1) and optimized wire codecs for minimal heap GC pressure.


| Environment | Metric | 3rd-Party Tag-based | 3rd-Party RPC-based | **DeukPack** |
| :--- | :--- | :---: | :---: | :---: |
| **C# / Unity** | Speed | ~ 45 ms | ~ 85 ms | **~ 28 ms** |
| | Memory | +4.5 MB | +12.0 MB | **0 MB (Zero)** |
| **C++ (Native)** | Speed | ~ 14 ms | ~ 22 ms | **~ 12 ms** |
| | Memory | Heap Alloc | Heap Alloc | **Manual Pool** |
| **Java (Backend)** | Speed | ~ 25 ms | ~ 38 ms | **~ 35 ms** |
| | Memory | Continuous | Large Objects | **+2.1 MB (Min)** |
| **JavaScript (V8)** | Speed | ~ 54 ms | ~ 190 ms | **~ 158 ms** |
| | Memory | +4.2 MB | -1.9 MB | **Immediate Reclaim** |
| **Elixir (BEAM)** | Speed | - | - | **~ 31 ms** |
| | Memory | - | - | **0 MB (Native Match)** |

> [!TIP]
> Figures are based on decoding a 10,000-row payload and may vary depending on the user environment.  
> 👉 **[View the detailed cross-language comparison matrix](https://deukpack.app/journal/performance-matrix/)** · **[Benchmarking Guide](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_BENCHMARKING.md)**


---

## Development

```bash
npm ci
npm run build
npm test
npm run test:idl-convert-smoke    # optional: Thrift → .deuk conversion smoke (tiny fixture)
```

---

## ☕ Support & Contact

DeukPack is completely open-source (Apache 2.0). I built this engine to solve the fundamental Zero-Allocation and Sync issues I've encountered over my career as a server architect.

If DeukPack is saving your team weeks of development time, or if you're planning to adopt it for a production MMORPG and need architectural advice on integrating it safely into your server stack, feel free to reach out via email.

- 📩 **Contact / Technical Inquiries**: joygram@gmail.com
- ☕ **Support the Project**: [Sponsor via Ko-fi](https://ko-fi.com/joygram)

Even if you aren't in a position to support financially, **starring the repo** or sharing it with a team juggling Protobuf/Thrift helps immensely.

---

## Works well with (Deuk Family)

**Want agents to do more with your specs?** Use **DeukPack** — IDL in, deterministic types and serializers out. **Want agents to behave predictably in your repo?** Use **[DeukAgentRules](https://github.com/joygram/DeukAgentRules)** — versioned `AGENTS.md` and rule templates via the [`deuk-agent-rule`](https://www.npmjs.com/package/deuk-agent-rule) npm package.

**Same repository as DeukPack** (optional dev dependency):

```bash
npm install -D deuk-agent-rule
npx deuk-agent-rule init --non-interactive
```

That adds shared handoff conventions and stack-aware rules alongside your pipeline — without changing how `deukpack` builds.

---

## Contributing

1. Fork → feature branch → PR.  
2. See [RELEASING.md](RELEASING.md) for release layout.

---

## License

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE).

---

## Acknowledgments

The broader IDL / OpenAPI / schema communities; DeukPack is a **standalone pipeline** (not an Apache Thrift subproject).
