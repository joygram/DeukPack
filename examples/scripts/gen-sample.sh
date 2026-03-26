#!/usr/bin/env bash
# Repo root: examples/sample_idl → examples/generated (csharp, cpp, javascript)
# Run thrift sample; for .proto use: ... sample_idl/sample.proto examples/generated ...
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
node scripts/build_deukpack.js examples/sample_idl/sample.thrift examples/generated \
  --csharp --cpp --js --protocol tbinary --allow-multi-namespace
echo "[OK] Sample codegen (thrift) → examples/generated/"
echo "     Protobuf: ... sample_idl/sample.proto examples/generated --csharp --cpp --js --protocol tbinary"
