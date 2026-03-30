/**
 * Single source for emitted/runtime version: ../package.json (DeukPack repo root).
 * Works when loaded from dist/*.js (__dirname === .../dist).
 */
import * as fsSync from 'fs';
import * as path from 'path';

let _cachedVersion: string | undefined;

export function getDeukPackPackageVersion(): string {
  if (_cachedVersion !== undefined) {
    return _cachedVersion;
  }
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const raw = fsSync.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    _cachedVersion =
      typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : '0.0.0';
  } catch {
    _cachedVersion = '0.0.0';
  }
  return _cachedVersion;
}

/** Replace @@DEUKPACK_VERSION@@ in codegen templates. */
export function substituteDeukPackVersionMarkers(text: string): string {
  return text.replace(/@@DEUKPACK_VERSION@@/g, getDeukPackPackageVersion());
}
