/**
 * DeukPack .deuk IDL Parser
 * Produces DeukPackAST from .deuk source using DeukLexer and DeukPackASTBuilder (deuk mode).
 */

import { DeukPackAST, DeukPackException } from '../types/DeukPackTypes';
import { DeukLexer } from '../lexer/DeukLexer';
import { DeukPackASTBuilder, DeukPackASTBuilderOptions } from '../ast/DeukPackASTBuilder';

export class DeukParser {
  private lexer: DeukLexer;
  private astBuilder: DeukPackASTBuilder;

  constructor() {
    this.lexer = new DeukLexer();
    this.astBuilder = new DeukPackASTBuilder();
  }

  parse(content: string, filePath: string, options?: DeukPackASTBuilderOptions): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, filePath, { deuk: true, ...options });
    } catch (error) {
      throw new DeukPackException(`Failed to parse .deuk file ${filePath}: ${(error as Error).message}`);
    }
  }
}
