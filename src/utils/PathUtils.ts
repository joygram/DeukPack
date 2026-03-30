/**
 * DeukPack Path & Include Utilities
 */

import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Normalized path key for cross-platform comparison
 */
export async function canonicalIncludeFileKey(filePath: string): Promise<string> {
  const normalizedAbs = path.resolve(path.normalize(filePath));
  try {
    return await fs.realpath(normalizedAbs);
  } catch {
    return normalizedAbs;
  }
}

export function normSourcePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

export function sourcePathsEqual(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false;
  return normSourcePath(a) === normSourcePath(b);
}
