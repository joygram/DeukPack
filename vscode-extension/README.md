# Deuk IDL

**DeukPack** IDL extension for VS Code. `.deuk` native, `.thrift` compatible.

## Features

- **Syntax highlighting** — `.deuk` / `.thrift` (Thrift compatible)
- **Linter** (diagnostics source: DeukPack)
  - Unclosed braces `{` `}`
  - Unclosed block comments `/*` `*/`
  - Trailing whitespace

## Install from VSIX (local)

1. Build the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npx @vscode/vsce package
   ```
2. In VS Code: **Extensions** → **...** → **Install from VSIX** → select `deuk-idl-0.1.0.vsix`.

## Publish to Marketplace

1. Set `publisher` and `repository` in `package.json`.
2. Install vsce: `npm i -g @vscode/vsce`
3. Log in: `vsce login <publisher>`
4. Publish: `vsce publish` (or `vsce publish -p <token>`).

## Language IDs

- `deuk` — DeukPack IDL (`.deuk`)
- `thrift` — DeukPack IDL, Thrift compatible (`.thrift`)

## Links

- [DeukPack site](https://deukpack.app/)
- [IDL guide](https://deukpack.app/tutorial/idl-guide/)
