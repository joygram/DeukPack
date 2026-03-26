# Changelog

Notable changes to the `deukpack` npm package by release.

**한국어:** [CHANGELOG.ko.md](CHANGELOG.ko.md)

---

## [1.2.10] — 2026-03-26

### Fixed

- **C++ native source encoding**: removed non-ASCII UTF-8 em-dash from `wire_engine.h` comment — eliminated MSVC **C4819** warning on Korean-locale Windows (`CP949`).
- **MSVC compile flags**: added **`/utf-8`** to `binding.gyp` (`msvs_settings`) and `native/cpp/CMakeLists.txt` — ensures source and execution charset are UTF-8 regardless of system locale.

### Changed

- **`npm run sync:oss:apply` / `version:sync` / `bundle:vscode`**: internal `npm install`/`npm ci` calls now use **`--loglevel=silent`** — suppresses EBADENGINE (Jest 30 ↔ Node 23 engine-range mismatch) and deprecated-package noise from console output during automation.
- **`package.json`**: added `npm` engine floor (`>=9.0.0`); added `.npmrc` to `files` so consumers inherit `fund=false` / `audit=false` defaults.
- **`.npmrc`** (repo root): `fund=false`, `audit=false` — no fund/audit noise on `npm install` in this repo.

---

## [1.2.9] — 2026-03-26

**Workspace modes** (`.deukpack/workspace.json`): **Package install** sets `installKind: "package"` — Unity `Packages/manifest.json` is updated from the published npm version (git UPM URLs); no local DeukPack checkout. **Source / dev mode** sets `installKind: "src"` and `deukPackRoot` — `deukpack sync` and postinstall **`npm install`** rebuild **netstandard2.0** **`DeukPack.Core`**, **`DeukPack.Protocol`**, **`DeukPack.ExcelProtocol`** (each **`.dll`** + **`.pdb`**) and copy them into the UPM runtime **Plugins** folder; package mode skips that DLL path.

### Added

- **`deukpack add`**: new CLI command installs family packages (`app.deukpack.navigation`, `app.deukpack.runtime`, etc.) into the workspace and updates Unity **`Packages/manifest.json`** for listed projects (both modes).
- **UPM package layout**: build script and pipeline profile schema for Unity Package Manager output; `package.json` template and directory structure generated on **`deukpack init`** (normal init flow).
- **`DeukPack.Core` assembly** (generated C#): split from `DeukPack.Protocol` — metadata and shared interfaces in a separate DLL. **Source / dev mode**: **`deukpack sync`** / Unity plugin build copies **`DeukPack.Core.dll`** (and **`.pdb`**) into **`app.deukpack.runtime`** **Plugins** together with **Protocol** and **ExcelProtocol**; codegen/game projects should reference **Core** where they only need shared meta, not the full protocol stack.

### Changed

- **`deukpack sync`** (alias `sync-runtime`): renamed for clarity. **Source / dev mode only** — runs when `installKind` is `"src"`; rebuilds **Core**, **Protocol**, and **ExcelProtocol** netstandard2.0 plugins and copies them to Unity **Plugins**. **Package install**: command exits after an informational skip (no local build).
- **`deukpack init` / `deukpack add`**: Unity manifest dependency sync restored; serverkit shares `app.deukpack.runtime` alongside navigation.
- **`deukpack init` end-of-run and `npm install` postinstall**: **Source / dev mode** — **Core** + **Protocol** + **ExcelProtocol** DLL build/copy, then manifest update; **package install** — manifest update only.

### Fixed

- **Security**: `picomatch` bumped to **2.3.2** (GHSA-c2c7-rcm5-vvqj, GHSA-3v7f-55p6-f55p).

---

## [1.2.8] — 2026-03-25

### Changed

- **Wire protocol naming**: Renamed **`tproto`** to **`protv2`** / **`protv3`** across types, serialization, tests, and docs. The `t-` prefix is now exclusively Thrift (`tbinary` / `tcompact` / `tjson`); the `proto-` prefix identifies Protobuf edition (proto2 / proto3).

---

## [1.2.7] — 2026-03-25

### Changed

- **C# (`DeukPack.Protocol`)**: **`DpFormat`** enum consolidated in **`DpProtocolCore`** — `Binary`, `Json`, `DeukJson`, `DeukYaml` (alias `Yaml`). New **`DpDeukYamlProtocol`** for Deuk YAML output.
- **C++**: **`DpProtocol.h`** template added; primitive codegen types mapped to `deuk::*` aliases.

---

## [1.2.6] — 2026-03-28

### Changed

- **Schema / embedded metadata**: Field and root schema `type` strings use **DeukPack spelling** (`struct`, `enum`, `int16` / `int32` / `int64`, etc.). **C#** `DpSchemaType` uses **`Int16` / `Int32` / `Int64`** with **`SchemaTypeToStandardString`** for string forms. **JSON compatibility wire** object keys (`i32`, `tf`, `str`, `lst`, …) are unchanged.
- **C# codegen**: Generated types initialize **`string`** / struct references so **`nullable` enable** builds stay clean; optional struct **`Clone()`** uses a null-forgiving path when codegen nullable mode is off.
- **CI**: **C++** native wire library **build + `ctest`** on **Ubuntu** and **Windows** runners.
- **Tooling**: **`npm run verify`** runs the same checks as the **GitHub Actions** workflow locally.

---

## [1.2.5] — 2026-03-27

### Changed

- **Package exports (`index`)**: The published npm API (`serialize` / `deserialize`, interop helpers, `packStructWire`, etc.) matches the public **GitHub** TypeScript entry; Excel-only protocol remains outside the open-source tree.
- **C# (`DeukPack.Protocol`)**: **`WriteString` / `WriteBinary`** use **`string?` / `byte[]?`** to match **`DpProtocol`** (CS8767). **`DpMetaInfosWrapper<T>.TryGetValue`** uses **`[MaybeNullWhen(false)]`** for **`IReadOnlyDictionary<,>`** consistency.

---

## [1.2.4] — 2026-03-26

### Changed

- **README (GitHub)**: English and Korean README copies used on **GitHub** rewrite documentation links to **[deukpack.app](https://deukpack.app/)** so readers land on the hosted docs.
- **Dependencies / toolchain**: **`nan`**, **`node-addon-api` ^8**, **`yaml`**; dev — **Jest 30**, **`protobufjs` ^8**, **`rimraf` ^6**, **`cmake-js` ^8**, **`node-gyp` ^12**, **`@vscode/vsce`**, **`@types/jest` ^30**, **`typescript` ^5.9**, **`@types/node` ^20.19**; **`engines.node` ≥18**; **`scripts/setup.js`** minimum **Node 18**.
- **Security**: **`npm audit fix`** — transitive **`minimatch`** high-severity ReDoS advisories addressed.

---

## [1.2.3] — 2026-03-25

### Changed

- **`deukpack init`**: Interactive flow trims prompts (directory-wide IDL only; no exclude/include-strategy questions); **bootstrap** (`.deukpack/workspace.json`) always runs; **`--skip-workspace` removed**.
- **VSIX**: Runs **after** workspace bootstrap; auto-install tries **`code`**, then **`cursor`**, then **`antigravity`** (`--install-extension`).
- **Docs**: README **`npx`** vs **`npm deukpack`** clarification; init order and postinstall wording aligned.

---

## [1.2.2] — 2026-03-24

### Added

- **Pipeline**: **`defineScope: "all"`** when **`thriftFile`** is omitted — collects every **`*.deuk`** under **`defineRoot`**, applies merged **`exclude`** (config + job), writes a short-lived bundle entry, then builds; bundle file removed after the job.
- **`outputLangSubdirs`**: optional per-job map **`{ csharp?, cpp?, ts?, js? }`** — each value is a **single** directory name under **`outputDir`** (for legacy layout use e.g. **`typescript`** / **`javascript`**).

### Changed

- **Breaking (codegen paths)**: **`--ts`** / **`--js`** (and pipeline **`ts`** / **`js`**) emit under **`<out>/ts/`** and **`<out>/js/`** instead of **`typescript/`** and **`javascript/`**.
- **Pipeline**: **`jobs[].outputDir`** may be **omitted** — defaults to the same relative path as **`defineRoot`** (default **`idls`**), so outputs are **`idls/csharp`**, **`…/cpp`**, **`…/ts`**, **`…/js`** when those generators run.
- **`deukpack init`**: default generated pipeline uses **`defineScope: "all"`** and **`outputDir`** aligned with **`defineRoot`**; interactive defaults updated.
- **Docs / examples / kits**: paths updated for **`ts`** / **`js`** outputs.

---

## [1.2.1] — 2026-03-24

### Changed

- **Docs**: **README** / **README.ko** — installation steps in **code blocks**; **project-local** `npm install deukpack` → `npx deukpack init` → `npx deukpack run`; **global `npm install -g`** removed from this guide; kits link label **DeukPack Tale** / **득팩 테일** (URL unchanged).
- **CLI**: One-shot `deukpack <entry> <outDir> …` **warns** when **`./deukpack.pipeline.json`** is missing; suggests **`npx deukpack init`** (build still runs).
- **`deukpack init` / bootstrap / bundled VSIX**: When **`.deukpack/deuk-idl-vsix.json`** records a different **npm `deukpack` version**, **attempt bundled VSIX install without prompting**; **Unity-near** detection strengthens install/skip messaging; **`--non-interactive` `init`** calls version-bump VSIX **ensure** when **`--skip-vsix`** is not set; **bootstrap** passes Unity hint into VSIX prompts and runs bump **ensure** when not TTY.

---

## [1.2.0] — 2026-03-23

### Added

- **Bundled VS Code extension**: npm tarball includes **`bundled/deuk-idl.vsix`**. **postinstall** re-attempts install when **`deukpack` npm version** changes vs **`.deukpack/deuk-idl-vsix.json`**. **Interactive `deukpack bootstrap`** prompts to install/update the VSIX. Details: **`bundled/README.md`**.
- **Unity**: **[deukpack.app](https://deukpack.app/)** documents embedding **DeukPack.Protocol** (and related) with UPM-style layout; native plugins are built by your game/project pipeline, not shipped inside the npm **`deukpack`** package.
- **npm wire entry (single shape)**: **`serialize(value, protocol?, extras?)`** / **`deserialize(data, protocol?, extras?)`** with exported **`WireExtras`** / **`WireDeserializeExtras`** (`pretty`, `interopRootStruct`, `interopStructDefs`, `targetType`, …). Full control remains via **`WireSerializer`** / **`WireDeserializer`** + **`SerializationOptions`**.

### Changed

- **Breaking (JS package entry)**: `serialize(_, protocol, prettyBoolean, wireFamily)` is removed — use **`serialize(_, protocol, { pretty: true, wireFamily?, … })`**. **`deserialize`** accepts **`string` | `Uint8Array` | `Buffer`** and takes the same **`WireExtras`**-shaped third argument (plus optional **`targetType`** for class-shaped output).
- **Wire (TypeScript)**: **`BinaryReader`**, **`wireTags`**, **`SerializationWarnings`**; **`WireSerializer` / `WireDeserializer`** expanded so **Deuk native** (`pack`, `json`, `yaml`) and **interop** (`tbinary`, `tcompact`, `tjson` + schema) stay paired. **C# `DeukPack.Protocol`**: csproj / **SharedCompile** props adjusted alongside.
- **CI**: GitHub Actions use **setup-dotnet** so `DeukPack.Protocol` builds reliably in workflows; YAML step-name quoting fixes for `:` / `&`.
- **Codegen**: C++ / TypeScript / JavaScript emit paths further **template-driven**; JS/schema output **DeukPack-oriented labeling** aligned with templates.
- **Docs**: DeukNavigation **game integration** (baking / runtime) expanded; **deukpack.app** updates.
- **Repo hygiene**: ExcelProtocol and example **build artifacts** moved under **gitignore** / removed from tracking.

---

## [1.1.0] — 2026-03-20

### Added

- **C++ codegen (`--cpp`)**: map `uint8` / `uint16` / `uint32` / `uint64` to `uint8_t` / `uint16_t` / `uint32_t` / `uint64_t` from `<cstdint>`; generated headers now `#include <cstdint>`.
- **IDL parser**: Thrift-style **legacy `message` blocks** without parenthesized numeric IDs (`message Name { ... }`) — better compatibility for existing `.thrift` / mixed workflows (`declarationKind` remains `message`).

### Fixed

- **C# runtime (DeukPack.Protocol)**: Binary-related enum and `IDisposable` handling; generated/runtime alignment.
- **CLI**: `bin/deukpack.js` forwarding to `scripts/build_deukpack.js` (cwd-independent resolution).

### Changed

- **Docs / site**: README one-liners; [deukpack.app](https://deukpack.app/) reference layout (tracks submodule commits).

### Verification — DeukPackKits StarterKit (local CLI `1.1.0`)

Checked **2026-03-23** with `npm run build` in this repo, then `node scripts/build_deukpack.js`:

| Kit path | Command | Result |
|----------|---------|--------|
| `DeukPackKits/StarterKit/csharp/prologue` | `idls/csharp.deuk` → `out` with `-I idls --csharp` | Success; `csharp.cs`, `MetaTableRegistry.g.cs`, `DeukDefine.csproj` emitted |
| `DeukPackKits/StarterKit/cpp/prologue` | `idls/cpp.deuk` → `out` with `-I idls --cpp` | Success; `cpp_deuk.h` / `cpp_deuk.cpp` emitted (suffix avoids hand-written header clashes); header includes `<cstdint>` |

*(Other StarterKit rooms were not all re-run in this check; use each room’s README command as needed.)*

---

## [1.0.x] — ~Mar 2026 (patch line)

### Summary

- Early **1.0.x** patches focused on **bugfixes, packaging, C# multi-targeting, and documentation paths** without expanding the core feature set.

---

For commits before this file existed, see `git log` and GitHub **Releases**.
