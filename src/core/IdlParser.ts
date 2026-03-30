/**
 * IDL Parser (.thrift-style source → DeukPackAST)
 * Same pattern as ProtoParser: lexer + shared AST builder.
 */

import { DeukPackAST, DeukPackException } from '../types/DeukPackTypes';
import { IdlLexer } from '../lexer/IdlLexer';
import { DeukPackASTBuilder, DeukPackASTBuilderOptions } from '../ast/DeukPackASTBuilder';
import { IdlLoadContext } from './IdlLoadContext';
import { DeukPackASTUtils } from '../utils/DeukPackASTUtils';

export class IdlParser {
  private lexer: IdlLexer;
  private astBuilder: DeukPackASTBuilder;
  private loadContext: IdlLoadContext;

  constructor() {
    this.lexer = new IdlLexer();
    this.astBuilder = new DeukPackASTBuilder();
    this.loadContext = new IdlLoadContext();
  }

  parse(content: string, filePath: string, options?: DeukPackASTBuilderOptions): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, filePath, options);
    } catch (error) {
      throw new DeukPackException(`Failed to parse file ${filePath}: ${(error as Error).message}`);
    }
  }

  async parseFiles(filePaths: string[], options?: DeukPackASTBuilderOptions): Promise<DeukPackAST> {
    const startTime = Date.now();
    try {
      const asts = await Promise.all(
        filePaths.map(filePath => this.parseFile(filePath, options))
      );
      const mergedAST = DeukPackASTUtils.mergeAndDeduplicate(asts);
      const endTime = Date.now();
      console.log(`Parsed ${filePaths.length} files in ${endTime - startTime}ms`);
      return mergedAST;
    } catch (error) {
      throw new DeukPackException(`Failed to parse files: ${(error as Error).message}`);
    }
  }

  async parseFile(filePath: string, options?: DeukPackASTBuilderOptions): Promise<DeukPackAST> {
    return this.loadContext.loadFile(filePath, (content, path) => {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, path, options);
    });
  }

  parseContent(content: string, fileName: string = 'input.idl', options?: DeukPackASTBuilderOptions): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, fileName, options);
    } catch (error) {
      throw new DeukPackException(`Failed to parse content: ${(error as Error).message}`);
    }
  }

  clearCache(): void { this.loadContext.clear(); }

  getCacheStats(): { size: number; files: string[] } {
    return this.loadContext.getStats();
  }
}
