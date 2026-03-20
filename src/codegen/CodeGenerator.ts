/**
 * DeukPack Code Generator
 * Base code generator class
 */

import { DeukPackAST, GenerationOptions } from '../types/DeukPackTypes';

export abstract class CodeGenerator {
  abstract generate(ast: DeukPackAST, options: GenerationOptions): Promise<string | { [filename: string]: string }>;
}