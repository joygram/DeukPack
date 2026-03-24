#!/usr/bin/env bash
# Repo root: examples/sample_idl → examples/out (csharp, cpp, javascript)
# Run thrift sample; for .proto use: ... sample_idl/sample.proto examples/out ...
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
node scripts/build_deukpack.js examples/sample_idl/sample.thrift examples/out \
  --csharp --cpp --js --protocol tbinary
echo "[OK] Sample codegen (thrift) → examples/out/"
echo "     Protobuf: ... sample_idl/sample.proto examples/out --csharp --cpp --js --protocol tbinary"
