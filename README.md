# DeukPack: AI-Native Universal IDL Gateway

> **Mixed-IDL Hybrid Serializer for the AI Era.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)

**Languages / 언어:** [English](README.md) · [한국어](README.ko.md)

**The AI Breakthrough:** Turn **Mixed-IDL definitions** (Protobuf, OpenAPI, JSON Schema, CSV, and legacy `.thrift`) into **deterministic, type-safe C#, C++, TypeScript, and JavaScript** with **AI Semantic Mapping**, **MCP Server Auto-Generation**, and **Zod-based Guardrails**.

**Start here — pick one path**

- **Ship it in your repo:** local install in the project root — **[Installation](#installation)** · **[Installation & tutorials](https://deukpack.app/en/tutorial/)**.
- **Read the manual:** **[deukpack.app](https://deukpack.app/en/)** — overview, protocol, **[API reference](https://deukpack.app/en/reference/api/)**.
- **Run a lab in a folder (🚧 Sealed - Coming Soon):** **[Hands-on from zero](https://kits.deukpack.app/en/starter-course/hands-on/)**; optional **[DeukPack Tale](https://kits.deukpack.app/en/journey/)** or *[Ruins](https://kits.deukpack.app/en/starter-course/)* for story-first onboarding.

**Sites and doc roles** are summarized in **[Documentation & links](#documentation--links)** below.

**npm / OSS public scope (v1 product line):** **IDL → multi-language codegen, CLI**, Binary/Compact/JSON wire. **Excel protocol and Excel add-in are distributed separately** — not part of core npm. **Scope & product line (maintainers):** [DEUKPACK_V1_RELEASE_SCOPE.md](https://deukpack.app/en/positioning/) · overview **[deukpack.app](https://deukpack.app/en/)**.

**Versions:** **Published** = `version` in [`package.json`](package.json) and the **npm badge** above. **1.0.x ↔ 1.1.0 ↔ 1.2.x** (and later) deltas: [CHANGELOG.md](CHANGELOG.md) (EN) · [CHANGELOG.ko.md](CHANGELOG.ko.md) (KO) · [DEUKPACK_V1_RELEASE_SCOPE.md](https://deukpack.app/en/positioning/) §0 / §0.1 — **DeukPackKits StarterKit** prologue codegen checks are noted in the changelog.

---

## Why DeukPack: The AI-Ready Advantage

### 1. Universal IDL Gateway (OpenAPI, JSON Schema, Protobuf, Thrift, CSV)
Modern systems often struggle with a fragmented mix of Specs—legacy (Thrift), modern (Protobuf/gRPC), and web-native (OpenAPI/JSON Schema). This fragmentation creates a massive "context gap" for both developers and AI.
- **Zero-Migration Hybrid Support:** You **don't have to convert** your existing `.proto` or `.thrift` files. DeukPack can extension legacy definitions with AI-native metadata or advanced types without modifying the source.
- **DeukPack Solution:** It acts as a **Single Source of Truth** that aggregates diverse IDL sources into one unified, semantic model. It's not just a converter; it's a bridge that maps types into a deterministic SDK while remaining **wire-compatible with your legacy protocols**.

### 2. IDL-to-AI Semantic Mapping
Go beyond basic data types. DeukPack extracts metadata from your IDL comments (`/** ... */`) and field structures, transforming them into a **'Semantic Context'** that AI can instantly grasp.
- **Breakthrough:** Engineers evolve from simple coders into high-level architects defining **data lineage** via a machine-readable semantic layer.

### 3. AI-Native Execution Bridge (MCP)
Traditional IDL tools produce static code. DeukPack produces a **Runtime Bridge**. 
- **DeukPack Solution:** It automatically generates a **Model Context Protocol (MCP)** server from your IDL. AI agents (Cursor, Claude Desktop) can **directly browse live documentation (Resources)** and **execute backend methods (Tools)** with Zod-based guardrails. You define the map; the AI drives the fleet—safely.

### 4. Zero-Allocation High Performance
DeukPack is engineered for extreme efficiency. Whether parsing 500+ IDL files or serializing massive objects, it remains **orders of magnitude faster** than classic industry flows.

---

## Installation

Tutorials and OS-specific notes: **[deukpack.app/tutorial](https://deukpack.app/en/tutorial/)**.

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
| **[deukpack.app](https://deukpack.app/en/)** | Install, tutorials, protocol, [API reference](https://deukpack.app/en/reference/api/) |
| **[kits.deukpack.app](https://kits.deukpack.app/en/)** | 🚧 Sealed — Coming Soon |
| **Kits lineup** | [deukpack.app/starter-kits](https://deukpack.app/en/starter-kits/) |
| **Korean README** | [README.ko.md](README.ko.md) |
| **Releases** | [RELEASING.md](RELEASING.md) |
| **Documentation index** | [deukpack.app — Documentation](https://deukpack.app/en/documentation-index/) |

**Contact:** contact@deukpack.app

---

## Performance (vs classic IDL-style flows)


| Area | Typical IDL compiler-style flow | DeukPack | Gain |
|------|-------------------------------|----------|------|
| Parse 160 files | 15–25s | 0.5–1s | **~25–50×** |
| TypeScript emit | 2–3s | 0.1–0.2s | **~15–30×** |
| Serialize | 0.5ms | 0.05ms | **~10×** |
| Deserialize | 0.8ms | 0.08ms | **~10×** |
| Memory | ~100MB | ~20MB | **~5×** |


---

## Development

```bash
npm ci
npm run build
npm test
npm run test:idl-convert-smoke    # optional: Thrift → .deuk conversion smoke (tiny fixture)
```

---

## Support development

DeukPack stays **free and Apache-2.0** — you can ship products on it without a license fee. That only works if the project stays **maintained**: documentation, CI, compatibility fixes, faster parsers, new language targets, and time to review issues and PRs.

If DeukPack **saves you CI minutes**, **replaces brittle hand-rolled serializers**, or **keeps your game/server stacks aligned on one IDL**, consider **chipping in**. A one-time or recurring tip **directly supports continued OSS work** on the engine, docs ([deukpack.app](https://deukpack.app/en/)), and releases — at any amount you’re comfortable with.

**Personal PayPal (maintainer)** — tips go to the **individual account** tied to **`joygram@gmail.com`**, not a separate legal entity. That keeps overhead low and funds time on DeukPack directly.

- **PayPal**: **Send** → **`joygram@gmail.com`**
- **Ko-fi**: [Support via Ko-fi](https://ko-fi.com/joygram) (card, Apple Pay, Google Pay, etc.)

This is **not** a tax-deductible charity donation unless you have a separate registered nonprofit; treat it as **support for the maintainer’s OSS work**.

Not in a position to donate? **Star the repo**, **open clear issues**, **send PRs**, or **tell a team** that’s juggling Protobuf + Thrift + OpenAPI — that helps too.

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
