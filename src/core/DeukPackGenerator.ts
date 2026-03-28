/**
 * DeukPack Generator
 * Multi-language code generation
 */

import { DeukPackAST, GenerationOptions } from '../types/DeukPackTypes';
import { McpGenerator } from '../codegen/mcp/McpGenerator';
import { CSharpGenerator } from '../codegen/CSharpGenerator';
import { CppGenerator } from '../codegen/cpp/CppGenerator';
import { TypeScriptGenerator } from '../codegen/typescript/TypeScriptGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DeukPackGenerator {
  async generateCode(ast: DeukPackAST, options: GenerationOptions): Promise<void> {
    const outDir = options.outputDir || 'dist';
    await fs.mkdir(outDir, { recursive: true });

    const generators = options.generators || ['csharp'];
    
    for (const genName of generators) {
      console.log(`[DeukPack] Generating ${genName}...`);
      let generator;
      switch (genName.toLowerCase()) {
        case 'mcp':
          generator = new McpGenerator();
          break;
        case 'csharp':
          generator = new CSharpGenerator();
          break;
        case 'cpp':
          generator = new CppGenerator();
          break;
        case 'typescript':
          generator = new TypeScriptGenerator();
          break;
        default:
          console.warn(`[DeukPack] Unknown generator: ${genName}. Skipping.`);
          continue;
      }

      const result = await generator.generate(ast, options);
      if (typeof result === 'string') {
        const fileName = genName.toLowerCase() === 'mcp' ? 'deukpack-mcp-server.js' : `generated_${genName}.txt`;
        await fs.writeFile(path.join(outDir, fileName), result);
      } else {
        for (const [file, content] of Object.entries(result)) {
          const fullPath = path.join(outDir, file);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content);
        }
      }
    }
  }
}
