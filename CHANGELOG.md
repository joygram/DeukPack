# Changelog

Notable changes to the `deukpack` npm package by release.

**한국어:** [CHANGELOG.ko.md](CHANGELOG.ko.md)

Baseline: **1.0.x** = public support scope in [docs/DEUKPACK_V1_RELEASE_SCOPE.md](docs/DEUKPACK_V1_RELEASE_SCOPE.md) (patches 1.0.1 … 1.0.5 share the same promise). **§0 / §0.1** in that doc summarize **1.0.x vs 1.1.0** and **1.2.0 vs 1.1.0**.

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
- **Docs / examples / kits**: paths updated for **`ts`** / **`js`**; **`YOUR_PROJECT`** **`build-deukpack.js`** stages from **`buildDir/ts`**, with fallback to **`buildDir/typescript`**.

---

## [1.2.1] — 2026-03-24

### Changed

- **Docs**: **README** / **README.ko** — installation steps in **code blocks**; **project-local** `npm install deukpack` → `npx deukpack init` → `npx deukpack run`; **global `npm install -g`** removed from this guide; kits link label **DeukPack Tale** / **득팩 테일** (URL unchanged).
- **CLI**: One-shot `deukpack <entry> <outDir> …` **warns** when **`./deukpack.pipeline.json`** is missing; suggests **`npx deukpack init`** (build still runs).
- **`deukpack init` / bootstrap / bundled VSIX**: When **`.deukpack/deuk-idl-vsix.json`** records a different **npm `deukpack` version**, **attempt bundled VSIX install without prompting**; **Unity-near** detection strengthens install/skip messaging; **`--non-interactive` `init`** calls version-bump VSIX **ensure** when **`--skip-vsix`** is not set; **bootstrap** passes Unity hint into VSIX prompts and runs bump **ensure** when not TTY.

---

## [1.2.0] — 2026-03-23

### Added

- **Bundled VS Code extension**: npm tarball includes **`bundled/deuk-idl.vsix`**. **postinstall** re-attempts install when **`deukpack` npm version** changes vs **`.deukpack/deuk-idl-vsix.json`**. **Interactive `deukpack bootstrap`** prompts to install/update the VSIX. **`sync-to-oss.js --build`** and post-sync OSS steps run **`bundle:vscode`** so **DeukPackOSS** carries the same VSIX. Details: **`bundled/README.md`**.
- **Release scope**: [docs/DEUKPACK_V1_RELEASE_SCOPE.md](docs/DEUKPACK_V1_RELEASE_SCOPE.md) **§0.1** — documents **Unity UPM integration**: embedded package **`app.deukpack.runtime`** with `Runtime/Plugins` for **DeukPack.Protocol** / **DeukPack.ExcelProtocol** (netstandard2.0), populated from a game repo build (e.g. `YOUR_PROJECT` `scripts/build-deukpack.js` → `deukPackUnityRuntimePluginsPath`). This is **not** shipped inside the npm `deukpack` tarball; it is the **recommended client layout** next to generated game code under `Assets/.../DeukDefine` (see `clientDeukDefinePath` in that repo’s config).
- **npm wire entry (single shape)**: **`serialize(value, protocol?, extras?)`** / **`deserialize(data, protocol?, extras?)`** with exported **`WireExtras`** / **`WireDeserializeExtras`** (`pretty`, `interopRootStruct`, `interopStructDefs`, `targetType`, …). Full control remains via **`WireSerializer`** / **`WireDeserializer`** + **`SerializationOptions`**.

### Changed

- **Breaking (JS package entry)**: `serialize(_, protocol, prettyBoolean, wireFamily)` is removed — use **`serialize(_, protocol, { pretty: true, wireFamily?, … })`**. **`deserialize`** accepts **`string` | `Uint8Array` | `Buffer`** and takes the same **`WireExtras`**-shaped third argument (plus optional **`targetType`** for class-shaped output).
- **Wire (TypeScript)**: **`BinaryReader`**, **`wireTags`**, **`SerializationWarnings`**; **`WireSerializer` / `WireDeserializer`** expanded so **Deuk native** (`pack`, `json`, `yaml`) and **interop** (`tbinary`, `tcompact`, `tjson` + schema) stay paired. **C# `DeukPack.Protocol`**: csproj / **SharedCompile** props adjusted alongside.
- **CI**: GitHub Actions use **setup-dotnet** so `DeukPack.Protocol` builds reliably in workflows; YAML step-name quoting fixes for `:` / `&`.
- **Codegen**: C++ / TypeScript / JavaScript emit paths further **template-driven**; JS/schema output **DeukPack-oriented labeling** aligned with templates.
- **Docs**: DeukNavigation **game integration** (baking / runtime) expanded; `deukpack.app` submodule bumps; internal **YOUR_PROJECT path standard** aligned (`clientDeukDefinePath`, UPM Plugins vs legacy “Assets/Core” wording removed).
- **Repo hygiene**: ExcelProtocol and example **build artifacts** moved under **gitignore** / removed from tracking.

### Unchanged (same as 1.1.0 promise)

- **§2** out-of-scope items in [DEUKPACK_V1_RELEASE_SCOPE.md](docs/DEUKPACK_V1_RELEASE_SCOPE.md) are **unchanged** for 1.2.0.

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

### Unchanged (same as 1.0.x promise)

- Items **out of scope** for v1 in §2 of [DEUKPACK_V1_RELEASE_SCOPE.md](docs/DEUKPACK_V1_RELEASE_SCOPE.md) (full table/Excel pipeline, `generateCode()` stub, no Java emit, etc.) are **still out of scope** in 1.1.0.

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

- **Scope** is fixed in [DEUKPACK_V1_RELEASE_SCOPE.md](docs/DEUKPACK_V1_RELEASE_SCOPE.md).
- Patches (e.g. 1.0.1–1.0.5) focused on **bugfixes, packaging, C# multi-targeting, doc paths** without widening §1 / §2.

---

For commits before this file existed, see `git log` and GitHub **Releases**.
