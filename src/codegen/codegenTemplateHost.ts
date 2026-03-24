/**
 * Shared template load/render for C#, C++, TypeScript, JavaScript emitters.
 * Paths: dist/codegen/templates/<lang>/ (after copy-codegen-templates) or src fallback.
 */

import * as fs from 'fs';
import * as path from 'path';
import { applyCodegenPlaceholders } from './templateRender';
import { substituteDeukPackVersionMarkers } from '../deukpackVersion';

export class CodegenTemplateHost {
  private readonly _cache = new Map<string, string>();

  constructor(private readonly _langDir: string) {}

  load(relPath: string): string {
    const key = `${this._langDir}/${relPath}`;
    const hit = this._cache.get(key);
    if (hit !== undefined) {
      return hit;
    }
    const primary = path.join(__dirname, 'templates', this._langDir, relPath);
    const fallback = path.join(__dirname, '..', '..', 'src', 'codegen', 'templates', this._langDir, relPath);
    const full = fs.existsSync(primary) ? primary : fallback;
    if (!fs.existsSync(full)) {
      throw new Error(`DeukPack: codegen template not found: ${this._langDir}/${relPath}`);
    }
    const text = substituteDeukPackVersionMarkers(fs.readFileSync(full, 'utf8'));
    this._cache.set(key, text);
    return text;
  }

  render(relPath: string, values: Record<string, string>): string {
    return applyCodegenPlaceholders(this.load(relPath), values);
  }
}
