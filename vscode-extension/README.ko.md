# Deuk IDL (득팩)

**득팩(DeukPack)** IDL 전용 확장. `.deuk` 기본, `.thrift` 호환.

## Features

- **Syntax highlighting** — `.deuk` / `.thrift` (Thrift 호환)
- **Linter** (진단 소스: DeukPack)
  - Unclosed braces `{` `}`
  - Unclosed block comments `/*` `*/`
  - Trailing whitespace

## Install from VSIX

**With npm `deukpack`:** after `npm install deukpack`, use `node_modules/deukpack/bundled/deuk-idl.vsix`:

```bash
code --install-extension "$(npm root)/deukpack/bundled/deuk-idl.vsix"
```

(`npm install` may auto-install when `code`, `cursor`, or `antigravity` is on PATH; set `DEUKPACK_SKIP_VSCODE_INSTALL=1` to skip.)

**From repo:** build locally:

```bash
cd vscode-extension
npm install
npm run compile
npx @vscode/vsce package
```

Then VS Code: **Extensions** → **...** → **Install from VSIX** → pick the generated `.vsix`.

## Publish to Marketplace

1. Set `publisher` and `repository` in `package.json`.
2. Install vsce: `npm i -g @vscode/vsce`
3. Log in: `vsce login <publisher>`
4. Publish: `vsce publish` (or `vsce publish -p <token>`).

## Language IDs

- `deuk` — 득팩 IDL (`.deuk`)
- `thrift` — 득팩 IDL, Thrift 호환 (`.thrift`)

## Links

- [DeukPack IDL design](../docs/internal/DEUKPACK_IDL_DESIGN.ko.md) (C++ style, `[id] type name;`, `import`)
