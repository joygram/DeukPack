/**
 * DeukPack Generator
 * Multi-language code generation
 */

import { DeukPackAST, GenerationOptions } from '../types/DeukPackTypes';
// import { McpGenerator } from '../codegen/mcp/McpGenerator';
import { CSharpGenerator } from '../codegen/CSharpGenerator';
import { CppGenerator } from '../codegen/cpp/CppGenerator';
import { TypeScriptGenerator } from '../codegen/typescript/TypeScriptGenerator';
import { JavaGenerator } from '../codegen/JavaGenerator';
import { JavaScriptGenerator } from '../codegen/javascript/JavaScriptGenerator';
import { PythonGenerator } from '../codegen/PythonGenerator';
import { ElixirGenerator } from '../codegen/ElixirGenerator';

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
          console.log(`[DeukPack] Notice: MCP features have been moved to the standalone 'DeukPackMcp' extension in v1.5.0.`);
          console.log(`[DeukPack] For AI context, use 'deukpack --export:ai-context' or look for the DeukPackMcp plugin coming soon.`);
          continue; // Skip the rest of the generation for MCP in Core
        case 'csharp':
          generator = new CSharpGenerator();
          break;
        case 'cpp':
          generator = new CppGenerator();
          break;
        case 'typescript':
          generator = new TypeScriptGenerator();
          break;
        case 'java':
          generator = new JavaGenerator();
          break;
        case 'javascript':
          generator = new JavaScriptGenerator();
          break;
        case 'python':
          generator = new PythonGenerator();
          break;
        case 'elixir':
          generator = new ElixirGenerator();
          break;
        default:
          console.warn(`[DeukPack] Unknown generator: ${genName}. Skipping.`);
          continue;
      }

      const result = await (generator as any).generate(ast, options);
      if (typeof result === 'string') {
        const fileName = `generated_${genName}.txt`;
        await fs.writeFile(path.join(outDir, fileName), result);
      } else {
        const records = result as Record<string, string>;
        for (const [file, content] of Object.entries(records)) {
          const fullPath = path.join(outDir, file);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content);
        }
      }
    }
  }
}
