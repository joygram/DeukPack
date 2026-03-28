#!/usr/bin/env bash
# DeukPack 클론 후 초기화 한 번에 실행 (Node 있으면 setup, 없으면 nvm으로 설치 후 setup)
# 사용: 프로젝트 루트에서  ./scripts/bootstrap.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Node 16+ 있으면 바로 setup
if command -v node >/dev/null 2>&1; then
    MAJOR=$(node -e "const v=process.version.slice(1).split('.'); console.log(parseInt(v[0],10))")
    if [ "$MAJOR" -ge 16 ] 2>/dev/null; then
        echo "[bootstrap] Node $(node -v) found. Running setup..."
        exec node scripts/setup.js "$@"
    fi
fi

# nvm으로 Node 설치 후 setup (한 방에)
echo "[bootstrap] Node not found. Installing via nvm..."
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "[bootstrap] Installing nvm..."
    mkdir -p "$NVM_DIR"
    (curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash) || true
fi
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    exec node scripts/setup.js "$@"
fi

echo "[bootstrap] Could not install Node. Install Node.js 16+ for your OS: https://nodejs.org/"
exit 1
