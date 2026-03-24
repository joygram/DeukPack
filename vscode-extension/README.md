# Deuk IDL

**DeukPack** IDL extension for VS Code. `.deuk` native, `.thrift` compatible.

## Features

- **Syntax highlighting** — `.deuk` / `.thrift` (Thrift compatible)
- **Linter** (diagnostics source: DeukPack)
  - Unclosed braces `{` `}`
  - Unclosed block comments `/*` `*/`
  - Trailing whitespace

## Install from VSIX

**With the npm `deukpack` package:** after `npm install deukpack`, the VSIX is at **`node_modules/deukpack/bundled/deuk-idl.vsix`**. Run:

```bash
code --install-extension "$(npm root)/deukpack/bundled/deuk-idl.vsix"
```

(`npm install deukpack` may install it automatically when `code`, `cursor`, or `antigravity` is on your PATH; skip with `DEUKPACK_SKIP_VSCODE_INSTALL=1`.)

**From this repo:** build locally:

```bash
cd vscode-extension
npm install
npm run compile
npx @vscode/vsce package
```

Then in VS Code: **Extensions** → **...** → **Install from VSIX** → select the generated `.vsix`.

## Publish to Marketplace

1. Set `publisher` and `repository` in `package.json`.
2. Install vsce: `npm i -g @vscode/vsce`
3. Log in: `vsce login <publisher>`
4. Publish: `vsce publish` (or `vsce publish -p <token>`).

## Language IDs

- `deuk` — DeukPack IDL (`.deuk`)
- `thrift` — DeukPack IDL, Thrift compatible (`.thrift`)

## Links

- [DeukPack site](https://deukpack.app/en/)
- [IDL guide](https://deukpack.app/en/tutorial/idl-guide/)
