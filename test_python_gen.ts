import { DeukPackGenerator } from './src/core/DeukPackGenerator';
import { DeukParser } from './src/core/DeukParser';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  const idlPath = 'src/codegen/__tests__/RoundtripModel.deuk';
  const idlText = await fs.readFile(idlPath, 'utf-8');
  const parser = new DeukParser();
  const ast = parser.parse(idlText, idlPath);
  
  const generator = new DeukPackGenerator();
  await generator.generateCode(ast, {
    outputDir: 'test_out',
    generators: ['python'],
    pythonNamespace: 'deuk.test'
  });
  
  console.log('Python generation complete. Check test_out/');
}

main().catch(console.error);
