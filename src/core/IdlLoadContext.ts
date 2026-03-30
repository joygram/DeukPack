import * as fs from 'fs/promises';
import { DeukPackAST, DeukPackException } from '../types/DeukPackTypes';
import { canonicalIncludeFileKey } from '../utils/PathUtils';

export class IdlLoadContext {
  private cache: Map<string, DeukPackAST> = new Map();
  private loadingStack: Set<string> = new Set();
  private maxDepth: number = 64;

  async loadFile(
    filePath: string,
    loader: (content: string, path: string) => DeukPackAST
  ): Promise<DeukPackAST> {
    const absolutePath = await canonicalIncludeFileKey(filePath);

    if (this.cache.has(absolutePath)) {
      return this.cache.get(absolutePath)!;
    }

    if (this.loadingStack.has(absolutePath)) {
      throw new DeukPackException(`Circular include detected: ${Array.from(this.loadingStack).join(' -> ')} -> ${absolutePath}`);
    }

    if (this.loadingStack.size >= this.maxDepth) {
      throw new DeukPackException(`Maximum include depth reached (${this.maxDepth}): ${absolutePath}`);
    }

    this.loadingStack.add(absolutePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      const ast = loader(content, absolutePath);
      this.cache.set(absolutePath, ast);
      return ast;
    } finally {
      this.loadingStack.delete(absolutePath);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; files: string[] } {
    return { size: this.cache.size, files: Array.from(this.cache.keys()) };
  }
}
