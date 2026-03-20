/**
 * Protocol Buffers (.proto) parser. Produces DeukPackAST from .proto source.
 * message → struct, enum → enum, package → namespace; same codegen/runtime as .deuk/.thrift.
 */

import { DeukPackAST, DeukPackException } from '../types/DeukPackTypes';
import { ProtoLexer } from '../proto/ProtoLexer';
import { ProtoASTBuilder } from '../proto/ProtoASTBuilder';

export class ProtoParser {
  private lexer: ProtoLexer;
  private astBuilder: ProtoASTBuilder;

  constructor() {
    this.lexer = new ProtoLexer();
    this.astBuilder = new ProtoASTBuilder();
  }

  parse(content: string, filePath: string): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, filePath);
    } catch (error) {
      throw new DeukPackException(`Failed to parse .proto file ${filePath}: ${(error as Error).message}`);
    }
  }
}
