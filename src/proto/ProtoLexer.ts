/**
 * Protocol Buffers (.proto) lexer. Tokenizes .proto source for ProtoASTBuilder.
 */

import { ProtoToken, ProtoTokenType } from './ProtoTypes';

export class ProtoLexer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: ProtoToken[] = [];

  private keywords: Map<string, ProtoTokenType> = new Map([
    ['message', ProtoTokenType.MESSAGE],
    ['enum', ProtoTokenType.ENUM],
    ['package', ProtoTokenType.PACKAGE],
    ['syntax', ProtoTokenType.SYNTAX],
    ['import', ProtoTokenType.IMPORT],
    ['option', ProtoTokenType.OPTION],
    ['optional', ProtoTokenType.OPTIONAL],
    ['repeated', ProtoTokenType.REPEATED],
    ['required', ProtoTokenType.REQUIRED],
    ['oneof', ProtoTokenType.ONEOF],
    ['map', ProtoTokenType.MAP],
    ['int32', ProtoTokenType.IDENTIFIER],
    ['int64', ProtoTokenType.IDENTIFIER],
    ['uint32', ProtoTokenType.IDENTIFIER],
    ['uint64', ProtoTokenType.IDENTIFIER],
    ['sint32', ProtoTokenType.IDENTIFIER],
    ['sint64', ProtoTokenType.IDENTIFIER],
    ['fixed32', ProtoTokenType.IDENTIFIER],
    ['fixed64', ProtoTokenType.IDENTIFIER],
    ['sfixed32', ProtoTokenType.IDENTIFIER],
    ['sfixed64', ProtoTokenType.IDENTIFIER],
    ['float', ProtoTokenType.IDENTIFIER],
    ['double', ProtoTokenType.IDENTIFIER],
    ['string', ProtoTokenType.IDENTIFIER],
    ['bytes', ProtoTokenType.IDENTIFIER],
    ['bool', ProtoTokenType.IDENTIFIER]
  ]);

  tokenize(input: string): ProtoToken[] {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;
      const token = this.nextToken();
      if (token && token.type !== ProtoTokenType.LINE_COMMENT && token.type !== ProtoTokenType.BLOCK_COMMENT) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({
      type: ProtoTokenType.EOF,
      value: '',
      position: this.position,
      line: this.line,
      column: this.column
    });
    return this.tokens;
  }

  private nextToken(): ProtoToken | null {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.position] || '';

    switch (char) {
      case '=': this.advance(); return this.createToken(ProtoTokenType.EQUALS, '=', startPos, startLine, startColumn);
      case ';': this.advance(); return this.createToken(ProtoTokenType.SEMICOLON, ';', startPos, startLine, startColumn);
      case ',': this.advance(); return this.createToken(ProtoTokenType.COMMA, ',', startPos, startLine, startColumn);
      case '.': this.advance(); return this.createToken(ProtoTokenType.DOT, '.', startPos, startLine, startColumn);
      case '{': this.advance(); return this.createToken(ProtoTokenType.LEFT_BRACE, '{', startPos, startLine, startColumn);
      case '}': this.advance(); return this.createToken(ProtoTokenType.RIGHT_BRACE, '}', startPos, startLine, startColumn);
      case '[': this.advance(); return this.createToken(ProtoTokenType.LEFT_BRACKET, '[', startPos, startLine, startColumn);
      case ']': this.advance(); return this.createToken(ProtoTokenType.RIGHT_BRACKET, ']', startPos, startLine, startColumn);
      case '<': this.advance(); return this.createToken(ProtoTokenType.LEFT_ANGLE, '<', startPos, startLine, startColumn);
      case '>': this.advance(); return this.createToken(ProtoTokenType.RIGHT_ANGLE, '>', startPos, startLine, startColumn);
      case '(': this.advance(); return this.createToken(ProtoTokenType.LEFT_BRACKET, '(', startPos, startLine, startColumn);
      case ')': this.advance(); return this.createToken(ProtoTokenType.RIGHT_BRACKET, ')', startPos, startLine, startColumn);
    }

    if (char === '"' || char === "'") return this.readStringLiteral();
    if (this.isDigit(char)) return this.readNumber();
    if (this.isAlpha(char) || char === '_') return this.readIdentifier();
    if (char === '/' && this.peek() === '/') return this.readLineComment();
    if (char === '/' && this.peek() === '*') return this.readBlockComment();

    this.advance();
    return null;
  }

  private readStringLiteral(): ProtoToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const quote = this.input[this.position];
    this.advance();
    let value = '';
    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\') {
        this.advance();
        if (this.position < this.input.length) value += this.readEscapeSequence();
      } else {
        value += this.input[this.position];
        this.advance();
      }
    }
    if (this.position < this.input.length) this.advance();
    return this.createToken(ProtoTokenType.STRING_LITERAL, value, startPos, startLine, startColumn);
  }

  private readEscapeSequence(): string {
    const c = this.input[this.position] || '';
    this.advance();
    switch (c) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '\\': return '\\';
      case '"': return '"';
      case "'": return "'";
      default: return c || '';
    }
  }

  private readNumber(): ProtoToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
      value += this.input[this.position];
      this.advance();
    }
    return this.createToken(ProtoTokenType.NUMBER, value, startPos, startLine, startColumn);
  }

  private readIdentifier(): ProtoToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.position < this.input.length &&
      (this.isAlphaNumeric(this.input[this.position] || '') || (this.input[this.position] || '') === '_')) {
      value += this.input[this.position];
      this.advance();
    }
    const keywordType = this.keywords.get(value);
    if (keywordType === ProtoTokenType.MESSAGE || keywordType === ProtoTokenType.ENUM ||
        keywordType === ProtoTokenType.PACKAGE || keywordType === ProtoTokenType.SYNTAX ||
        keywordType === ProtoTokenType.IMPORT || keywordType === ProtoTokenType.OPTION ||
        keywordType === ProtoTokenType.OPTIONAL || keywordType === ProtoTokenType.REPEATED ||
        keywordType === ProtoTokenType.REQUIRED || keywordType === ProtoTokenType.ONEOF ||
        keywordType === ProtoTokenType.MAP) {
      return this.createToken(keywordType, value, startPos, startLine, startColumn);
    }
    return this.createToken(ProtoTokenType.IDENTIFIER, value, startPos, startLine, startColumn);
  }

  private readLineComment(): ProtoToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    this.advance();
    this.advance();
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      value += this.input[this.position];
      this.advance();
    }
    return this.createToken(ProtoTokenType.LINE_COMMENT, value, startPos, startLine, startColumn);
  }

  private readBlockComment(): ProtoToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    this.advance();
    this.advance();
    while (this.position < this.input.length - 1) {
      if (this.input[this.position] === '*' && this.input[this.position + 1] === '/') {
        this.advance();
        this.advance();
        break;
      }
      value += this.input[this.position];
      this.advance();
    }
    return this.createToken(ProtoTokenType.BLOCK_COMMENT, value, startPos, startLine, startColumn);
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && this.isWhitespace(this.input[this.position] || '')) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else this.column++;
      this.position++;
    }
  }

  private advance(): void {
    if (this.position < this.input.length) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else this.column++;
      this.position++;
    }
  }

  private peek(): string {
    return this.position + 1 < this.input.length ? (this.input[this.position + 1] || '') : '';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }
  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }
  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }
  private isWhitespace(c: string): boolean {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r';
  }

  private createToken(type: ProtoTokenType, value: string, position: number, line: number, column: number): ProtoToken {
    return { type, value, position, line, column };
  }
}
