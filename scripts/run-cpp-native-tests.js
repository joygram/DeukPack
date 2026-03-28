#!/usr/bin/env node
/**
 * Configure, build, and ctest native/cpp (wire_roundtrip). Linux/macOS: default CMake generator.
 * Windows: Visual Studio generator (NMake is not in PATH in many Git Bash / minimal installs).
 *
 * Env (optional, Windows):
 *   DEUKPACK_CPP_CMAKE_GENERATOR — default "Visual Studio 17 2022"
 *   DEUKPACK_CPP_CMAKE_ARCH      — default x64
 *   CMAKE_TOOLCHAIN_FILE         — passed through (e.g. vcpkg.cmake)
 *   DEUKPACK_VCPKG_ROOT          — if set and CMAKE_TOOLCHAIN_FILE unset, adds
 *                                  -DCMAKE_TOOLCHAIN_FILE=<root>/scripts/buildsystems/vcpkg.cmake
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

const isWin = process.platform === 'win32';
let configure = 'cmake -S native/cpp -B native/cpp/build';
if (isWin) {
  const gen = process.env.DEUKPACK_CPP_CMAKE_GENERATOR || 'Visual Studio 17 2022';
  const arch = process.env.DEUKPACK_CPP_CMAKE_ARCH || 'x64';
  configure += ` -G "${gen}" -A ${arch}`;
}
if (process.env.CMAKE_TOOLCHAIN_FILE) {
  const t = process.env.CMAKE_TOOLCHAIN_FILE.replace(/"/g, isWin ? '""' : '\\"');
  configure += ` -DCMAKE_TOOLCHAIN_FILE="${t}"`;
} else if (process.env.DEUKPACK_VCPKG_ROOT) {
  const vcpkgRoot = path.resolve(process.env.DEUKPACK_VCPKG_ROOT);
  const tc = path.join(vcpkgRoot, 'scripts', 'buildsystems', 'vcpkg.cmake');
  const tcEsc = tc.replace(/"/g, isWin ? '""' : '\\"');
  configure += ` -DCMAKE_TOOLCHAIN_FILE="${tcEsc}"`;
}
}
}

execSync(configure, { stdio: 'inherit', shell: isWin });
execSync('cmake --build native/cpp/build --config Release', { stdio: 'inherit', shell: isWin });
execSync('ctest --test-dir native/cpp/build --output-on-failure -C Release', {
  stdio: 'inherit',
  shell: isWin,
});
