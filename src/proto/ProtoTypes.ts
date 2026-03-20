/**
 * Protocol Buffers (.proto) token types and token for use by ProtoLexer/ProtoASTBuilder.
 */

export enum ProtoTokenType {
  MESSAGE = 'MESSAGE',
  ENUM = 'ENUM',
  PACKAGE = 'PACKAGE',
  SYNTAX = 'SYNTAX',
  IMPORT = 'IMPORT',
  OPTION = 'OPTION',
  OPTIONAL = 'OPTIONAL',
  REPEATED = 'REPEATED',
  REQUIRED = 'REQUIRED',
  ONEOF = 'ONEOF',
  MAP = 'MAP',
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING_LITERAL = 'STRING_LITERAL',
  EQUALS = 'EQUALS',
  SEMICOLON = 'SEMICOLON',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',
  LEFT_ANGLE = 'LEFT_ANGLE',
  RIGHT_ANGLE = 'RIGHT_ANGLE',
  COMMA = 'COMMA',
  DOT = 'DOT',
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',
  EOF = 'EOF'
}

export interface ProtoToken {
  type: ProtoTokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}
