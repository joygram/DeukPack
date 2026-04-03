# DeukPack: AI-Native Universal Schema Multi-hub

> **Universal Schema Multi-hub for Protobuf, Thrift, OpenAPI, and .deuk. (High-Performance)**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![npm downloads](https://img.shields.io/npm/dm/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![GitHub stars](https://img.shields.io/github/stars/joygram/DeukPack.svg?style=social)](https://github.com/joygram/DeukPack/stargazers)

**Languages / 언어:** [English](README.md) · [한국어](README.ko.md)

Turn **any IDL** (Protobuf, OpenAPI, JSON Schema, `.deuk`) into **type-safe, deterministic code** across C#, C++, TypeScript, JavaScript, Java, and Elixir — with a single, unified serialization API.

---

> [!WARNING]
> ### 🚨 [IMPORTANT] Core Architecture Unification & Migration Notice (v1.8.0+)
> The core infrastructure has been heavily optimized and completely unified into **`DeukPackCodec`** across all languages!
> 
> - **Unified API:** You no longer need to call verbose factory methods. All languages now intuitively share the same 2-Method struct syntax: **`Hero.Pack()`** and **`Hero.Unpack()`**. (Legacy APIs are temporarily maintained for backward compatibility).
> - **⚠️ CAUTION (C# / Unity Users):** If you manually copy generated `.cs` runtime files, you **MUST completely empty that legacy folder** prior to importing the new files to prevent duplicate declaration compile errors. (npm / UPM users are automatically updated).

---

## Why DeukPack: The AI-Ready Advantage

### 1. Universal IDL Gateway (OpenAPI, JSON Schema, Protobuf, Thrift, CSV)
Modern systems often struggle with a fragmented mix of Specs—legacy (Thrift), modern (Protobuf/gRPC), and web-native (OpenAPI/JSON Schema). DeukPack acts as a **Single Source of Truth** that aggregates diverse IDL sources into one unified, semantic model — wire-compatible with your legacy protocols.

### 2. IDL-to-AI Semantic Mapping

DeukPack extracts metadata from IDL comments and field structures, transforming them into a **Semantic Context** that AI can instantly grasp. Designers evolve into architects defining **data lineage** via a machine-readable semantic layer.

### 3. AI-Native Execution Bridge (MCP Plugin Support)

The **Model Context Protocol (MCP)** server auto-generation feature (`DeukPackMcp`) lets AI agents (Cursor, Claude, etc.) browse live documentation and execute backend methods directly.

### 4. High-Performance In-place Reuse

Engineered for extreme efficiency. By using the `Unpack(cached, data)` pattern to reuse existing instances, we achieve a **60–100% reduction in memory allocation** and a **250% increase in JS parsing speed** vs. classic industry flows.

---

## ⚡ Two Words. Every Language.

DeukPack v1.7.6 introduces a **universal 2-method serialization API**: **`Pack`** and **`Unpack`**.  
Regardless of language or wire format — binary, JSON, Zero-Alloc — you only need to remember two verbs.

```
Pack    → Serialize (data out)
Unpack  → Deserialize (data in)
```

Pass a **format parameter** to switch protocols. Call `Unpack` on an **existing instance** for Zero-Alloc overwrite.  
That's the entire API surface.

> [!CAUTION]
> **Unity / C# Notice (Zero-Alloc Defense):**
> NEVER use `var h = Hero.Unpack(bin);` (Factory method) for high-frequency network packets (Hotpath). It implicitly triggers `new` allocations, causing GC spikes and severe frame drops.
> You MUST use **`Hero.Unpack(cachedHero, bin);`** to overwrite pre-allocated (pooled) objects to minimize allocations. (Note: While containers and root objects are reused, new instances may still be allocated for elements within nested struct lists unless custom pooling is implemented.)

```csharp
// C# / Unity: 1.Create  2.Pack  3.Unpack (Zero-Alloc)
var hero = new Dto.Hero { id = 1, name = "Deuk" };
byte[] bin = Dto.Hero.Pack(hero);          // Serialize (Static)
Dto.Hero.Unpack(hero, bin);                // Zero-Alloc (Static-Update)
```

```typescript
// TypeScript / JavaScript: 1.Create  2.Pack  3.Unpack (No Class Wrappers)
const hero = Dto.Hero.create({ id: 1, name: "Deuk" });
const bin = Dto.Hero.pack(hero);           // Serialize
Dto.Hero.unpack(hero, bin);                // In-place Update
```

```cpp
// C++ (Native): 1.Create  2.Pack  3.Unpack (Memory Safe)
Dto::Hero hero; hero.id = 1; hero.name = "Deuk";
auto bin = Dto::Hero::Pack(hero);          // Serialize
Dto::Hero::Unpack(hero, bin);              // Zero-Alloc Deserialize
```

```java
// Java: 1.Create  2.Pack  3.Unpack (High-Performance)
Dto.Hero hero = new Dto.Hero(1, "Deuk");
byte[] bin = Dto.Hero.pack(hero);          // Serialize (Static)
Dto.Hero.unpack(hero, bin);                // In-place Overwrite (Static)
```

```elixir
# Elixir: 1.Create  2.Pack  3.Unpack (BEAM Native)
hero = %Dto.Hero{id: 1, name: "Deuk"}      # Immutable Struct
bin = Dto.Hero.pack(hero)                  # Serialize
hero_parsed = Dto.Hero.unpack(bin)         # BEAM Pattern Match
```


---

### 🚀 Quick Start

```bash
npx deukpack init
```

**1. Define your schema (or import OpenAPI / Protobuf)**

```deuk
namespace Dto

struct Hero {
    1> int32 id
    2> string name
    3> float hp
}
```


---

### 🔄 Backward Compatibility — Existing Code is Safe

All **legacy method names are preserved as deprecated aliases**. No breaking changes.

| Old API (still works) | New equivalent |
| :--- | :--- |
| `Hero.toBinary(obj)` | `Hero.pack(obj)` |
| `Hero.toJson(obj)` | `Hero.pack(obj, 'json')` |
| `Hero.fromBinary(buf)` | `Hero.unpack(buf)` |
| `Hero.fromJson(str)` | `Hero.unpack(str, 'json')` |
| `Hero.unpackInto(obj, buf)` | `Hero.unpack(obj, buf)` |
| `DeukPackCodec.UnpackInto(obj, data)` | `obj.Unpack(data)` *(C#)* |

Your existing project will compile without errors. IDE will show **soft deprecation warnings** to guide migration at your own pace.

---

### 🎮 Real-World Pattern: Unity Game Client (Zero-Alloc)

```csharp
Dto.Hero cachedHero = new Dto.Hero(); // Allocated exactly ONCE at startup

void OnNetworkMessage(byte[] inputData) {
    // Zero-Garbage Deserialization — NO new class allocations, NO GC spikes!
    cachedHero.Unpack(inputData);
    Debug.Log($"Hero: {cachedHero.name}, HP: {cachedHero.hp}");

    // Mutate and re-serialize (Note: byte[] reuse requires Stream API)
    cachedHero.hp -= 10f;
    byte[] outputData = Dto.Hero.Pack(cachedHero);
    network.Send(outputData);
}
```

---


## 🚀 Release Roadmap

| Version | Key Milestones | Status |
| :--- | :--- | :--- |
| **v1.4.0** | MCP Protobuf expansion, C#/C++/JS core runtime stabilization | **DONE** |
| **v1.5.0** | **Java & Core Parity**: Inheritance, Compact/TJSON protocols, MCP Core Decoupling | **DONE** |
| **v1.5.1** | **C++ Zero-Alloc Optimization**: Arena allocator, C++ DDL Generator | **DONE** |
| **v1.6.0** | **V8 JIT Codegen & Zero-Alloc Architecture**: Ultimate JS/C# memory optimizations | **DONE** |
| **v1.7.0** | **Elixir Engine Support**: Native BEAM pattern matching & Universal Protocol Security Shield | **DONE** |
| **v1.8.0** | **Unified 2-Method API**: `Pack`/`Unpack` standard across all 6 languages | **DONE** |
| **v1.8.1** | **Dialyzer & CI Security**: Strict Elixir typing and GitHub Actions `sample.deuk` pure migration | **Current** |

---

## ⚡ Performance: The Zero-Bottleneck Foundation

| Environment | Metric | 3rd-Party Tag-based | 3rd-Party RPC-based | **DeukPack** |
| :--- | :--- | :---: | :---: | :---: |
| **C# / Unity** | Speed | ~ 45 ms | ~ 85 ms | ~ **28 ms** |
| | Memory | +4.5 MB | +12.0 MB | **0 MB (with Pooling*)** |
| **C++ (Native)** | Speed | ~ 14 ms | ~ 22 ms | ~ **12 ms** |
| | Memory | Heap Alloc | Heap Alloc | **Manual Pool** |
| **Java (Backend)** | Speed | ~ 25 ms | ~ 38 ms | ~ **35 ms** |
| | Memory | Continuous | Large Objects | **+2.1 MB (Min)** |
| **JavaScript (V8)** | Speed | ~ 54 ms | ~ 190 ms | ~ **158 ms** |
| | Memory | +4.2 MB | -1.9 MB | **Immediate Reclaim** |
| **Elixir (BEAM)** | Speed | ~ 62 ms | ~ 98 ms | ~ **31 ms** |
| | Memory | +12.8 MB | +14.5 MB | **0 MB (Native Match)** |

> Figures based on decoding a 10,000-row payload. Results vary by environment.  
> *C# 0 MB: Based on reuse of top-level and collection container instances. (Nested struct elements within lists may still trigger allocations unless an object pool is used.)
> 👉 [Detailed cross-language matrix](https://deukpack.app/journal/performance-matrix/) · [Benchmarking Guide](docs/DEUKPACK_BENCHMARKING.md)

---

## Feature Matrix

| Category | Feature | TS / JS | C# / Unity | C++ | Java | Elixir |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **IDL Core** | Basic Types / Aliases | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inheritance** | `extends` support | ✅ | ✅ | ✅ | ✅ (v1.5) | ✅ |
| **Unified API** | `Pack` / `Unpack` (2-method) | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 |
| **Protocols** | Native Pack (.dpk) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Protobuf Compatible | ✅ | ✅ | ✅ | ✅ | - |
| | Thrift Compatible (T-Series) | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| | JSON (Tagged / POJO) | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| | YAML / CSV | ✅ | ✅ (v1.2.7) | 🚧 | 🚧 | - |
| **Optimizations**| Zero-Alloc / JIT | ✅ (v1.6) | ✅ | ✅ (v1.4.2) | 🚧 | ✅ (BEAM) |
| | `Write` Logic Overrides | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| **Data/Meta** | `tablelink` / MetaTable | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| **AI Integration** | MCP Tool Auto-Generation | ✅ (v1.5) | 🚧 | - | - | - |
| | Intelligent Context | ✅ | ✅ | ✅ | ✅ | ✅ |
| | IDE IntelliSense | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Installation

```bash
npm install deukpack
npx deukpack init
npx deukpack run         # default: ./deukpack.pipeline.json
```

Tutorials and OS-specific notes: **[deukpack.app/tutorial](https://deukpack.app/tutorial/)**.

---

## 🛡️ Security & Reliability (OOM Defense / Anti-DDoS)

DeukPack implements strict defense-in-depth against **network-layer parsing vulnerabilities (OOM, Buffer Flooding, Infinite Recursion)**:

- **Universal OOM Defense (v1.7.0+)**: Enforced `MAX_SAFE_LENGTH` (10MB) and `MAX_ELEMENT_COUNT` (1,000,000) limits across all engines. Malicious packets are discarded (Fail-Fast) before any memory allocation.
- **Progressive Chunk Validation**: Replaces legacy `ReadToEnd()` with length pre-evaluation, neutralizing JSON stack bombing in Node.js and Java backends.
- **Continuous DDoS Fuzzer Suite**: CI-integrated `test-fuzz-oom.js` bombards all parsers with 2GB+ abnormal buffers.

---

## Documentation & Links

| Type | Link |
| :--- | :--- |
| **This README** | Clone-time summary |
| **Feature overview** | [DEUKPACK_FEATURES.md](docs/DEUKPACK_FEATURES.md) · [KO](docs/DEUKPACK_FEATURES.ko.md) |
| **[deukpack.app](https://deukpack.app/)** | Install, tutorials, protocol, [API reference](https://deukpack.app/reference/api/) |
| **Korean README** | [README.ko.md](README.ko.md) |
| **Releases** | [RELEASING.md](RELEASING.md) |
| **Full doc index** | [docs/README.ko.md](docs/README.ko.md) |

**Contact:** contact@deukpack.app

---

## Development

```bash
npm ci
npm run build
npm test
npm run benchmark                     # Node serialize smoke
npm run bench:format-parity           # parser comparison
npm run bench:cross-lang              # Node vs .NET pack
```

---

## ☕ Support & Contact

DeukPack is completely open-source (Apache 2.0). Built to solve fundamental Zero-Allocation and Sync issues from 30 years of server architecture experience.

- 📩 **Contact / Technical Inquiries**: joygram@gmail.com
- ☕ **Support the Project**: [Sponsor via Ko-fi](https://ko-fi.com/joygram)

**Starring the repo** or sharing it with teams juggling Protobuf/Thrift helps immensely.

---

## Works well with (Deuk Family)

**Want agents to do more with your specs?** Use **DeukPack** — IDL in, deterministic types and serializers out.  
**Want agents to behave predictably in your repo?** Use **[DeukAgentRules](https://github.com/joygram/DeukAgentRules)** — versioned `AGENTS.md` and rule templates.

```bash
npm install -D deuk-agent-rule
npx deuk-agent-rule init --non-interactive
```

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
