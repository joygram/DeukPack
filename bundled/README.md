# Bundled artifacts (npm package)

Files in this folder ship inside the **`deukpack`** npm tarball (see root `package.json` → `files`).

| Artifact | Description |
|----------|-------------|
| **`deuk-idl.vsix`** | **Deuk IDL** VS Code extension (syntax, lint, format, themes). Built at publish time from `../vscode-extension/`; version inside the VSIX matches the **`deukpack`** package version. |

## Install the VSIX

The same **`.vsix`** installs into **VS Code**, **Cursor**, or **Antigravity** via each product’s CLI when it is on your `PATH`.

After `npm install deukpack`, from your project root:

**VS Code** (if `code` is on your `PATH`):

```bash
code --install-extension "$(npm root)/deukpack/bundled/deuk-idl.vsix"
```

**Cursor** (if `cursor` is on your `PATH`):

```bash
cursor --install-extension "$(npm root)/deukpack/bundled/deuk-idl.vsix"
```

**Antigravity** (if `antigravity` is on your `PATH`):

```bash
antigravity --install-extension "$(npm root)/deukpack/bundled/deuk-idl.vsix"
```

On **Windows** (cmd), use `%npm_root%` or run `npm root` once and paste the path.

**postinstall** (after `npm install deukpack` in your app repo) prints a **short hint** to run **`npx deukpack init`** only when **neither** `deukpack.pipeline.json` **nor** `.deukpack/workspace.json` exists yet (skipped on **CI**, **`DEUKPACK_SKIP_POSTINSTALL=1`**, or global install). **`npx deukpack init`** writes the pipeline file, runs **bootstrap** (`.deukpack/workspace.json`), then **attempts VSIX install** last (no Y/N prompt unless you pass **`--skip-vsix`**). Standalone **`npx deukpack bootstrap`** is the same as **`npx deukpack init --workspace-only`**.

**`npx deukpack bootstrap`** ends with the same VSIX install attempt when **`--skip-vsix`** is not set.

You may add **`.deukpack/deuk-idl-vsix.json`** to **`.gitignore`** if install state should not be committed.

## Future bundles

Additional co-shipped tools (e.g. other editor plugins) can be added here and listed in this table; keep root `package.json` `files` in sync.
