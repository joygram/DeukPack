/**
 * DeukPack .deuk IDL Lexer
 * Tokenizes .deuk source; produces same token types as IdlLexer where possible
 * so that AST can be ThriftAST. Adds: record/struct → RECORD(득팩 표준), 득팩 숫자형 (int32→I32, int64→I64, etc.)
 */

import { DeukPackToken, TokenType } from '../types/DeukPackTypes';

export class DeukLexer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: DeukPackToken[] = [];

  private keywords: Map<string, TokenType> = new Map([
    ['namespace', TokenType.NAMESPACE],
    ['struct', TokenType.RECORD],
    ['record', TokenType.RECORD],
    ['entity', TokenType.ENTITY],
    ['enum', TokenType.ENUM],
    ['service', TokenType.SERVICE],
    ['typedef', TokenType.TYPEDEF],
    ['const', TokenType.CONST],
    ['include', TokenType.INCLUDE],
    ['exception', TokenType.EXCEPTION],
    ['union', TokenType.UNION],
    ['required', TokenType.REQUIRED],
    ['optional', TokenType.OPTIONAL],
    ['bool', TokenType.BOOL],
    ['byte', TokenType.BYTE],
    ['i16', TokenType.I16],
    ['i32', TokenType.I32],
    ['i64', TokenType.I64],
    ['int8', TokenType.BYTE],
    ['int16', TokenType.I16],
    ['int32', TokenType.I32],
    ['int64', TokenType.I64],
    ['double', TokenType.DOUBLE],
    ['float', TokenType.DOUBLE],
    ['string', TokenType.STRING],
    ['binary', TokenType.BINARY],
    ['list', TokenType.LIST],
    ['array', TokenType.ARRAY],
    ['set', TokenType.SET],
    ['map', TokenType.MAP],
    ['tablelink', TokenType.TABLELINK],
    ['table', TokenType.TABLE]
  ]);

  tokenize(input: string): DeukPackToken[] {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;
      const token = this.nextToken();
      if (token && token.type !== TokenType.WHITESPACE) this.tokens.push(token);
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      position: this.position,
      line: this.line,
      column: this.column
    });
    return this.tokens;
  }

  private nextToken(): DeukPackToken | null {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.position] || '';

    switch (char) {
      case '=': this.advance(); return this.createToken(TokenType.EQUALS, '=', startPos, startLine, startColumn);
      case ':': this.advance(); return this.createToken(TokenType.COLON, ':', startPos, startLine, startColumn);
      case ';': this.advance(); return this.createToken(TokenType.SEMICOLON, ';', startPos, startLine, startColumn);
      case ',': this.advance(); return this.createToken(TokenType.COMMA, ',', startPos, startLine, startColumn);
      case '.': this.advance(); return this.createToken(TokenType.DOT, '.', startPos, startLine, startColumn);
      case '*': this.advance(); return this.createToken(TokenType.ASTERISK, '*', startPos, startLine, startColumn);
      case '{': this.advance(); return this.createToken(TokenType.LEFT_BRACE, '{', startPos, startLine, startColumn);
      case '}': this.advance(); return this.createToken(TokenType.RIGHT_BRACE, '}', startPos, startLine, startColumn);
      case '[': this.advance(); return this.createToken(TokenType.LEFT_BRACKET, '[', startPos, startLine, startColumn);
      case ']': this.advance(); return this.createToken(TokenType.RIGHT_BRACKET, ']', startPos, startLine, startColumn);
      case '<': this.advance(); return this.createToken(TokenType.LEFT_BRACKET, '<', startPos, startLine, startColumn);
      case '>': this.advance(); return this.createToken(TokenType.RIGHT_BRACKET, '>', startPos, startLine, startColumn);
      case '(': this.advance(); return this.createToken(TokenType.LEFT_PAREN, '(', startPos, startLine, startColumn);
      case ')': this.advance(); return this.createToken(TokenType.RIGHT_PAREN, ')', startPos, startLine, startColumn);
    }

    if (char === '"' || char === "'") return this.readStringLiteral();
    if (this.isDigit(char)) return this.readNumber();
    if (this.isAlpha(char) || char === '_') return this.readIdentifier();
    if (char === '/' && this.peek() === '/') return this.readLineComment();
    if (char === '/' && this.peek() === '*') return this.readBlockComment();
    if (char === '#' || (char === '-' && this.peek() === '-')) return this.readLineComment();

    this.advance();
    return null;
  }

  private readStringLiteral(): DeukPackToken {
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
    return this.createToken(TokenType.STRING_LITERAL, value, startPos, startLine, startColumn);
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

  private readNumber(): DeukPackToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    if (this.input[this.position] === '0') {
      const nx = this.peek();
      if (nx === 'x' || nx === 'X') {
        value += '0';
        this.advance();
        value += this.input[this.position] || '';
        this.advance();
        let digits = 0;
        while (this.position < this.input.length && this.isHexDigit(this.input[this.position] || '')) {
          value += this.input[this.position];
          this.advance();
          digits++;
        }
        if (digits === 0) return this.createToken(TokenType.NUMBER, '0', startPos, startLine, startColumn);
        return this.createToken(TokenType.NUMBER, value, startPos, startLine, startColumn);
      }
    }
    while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
      value += this.input[this.position];
      this.advance();
    }
    if (this.input[this.position] === '.') {
      value += this.input[this.position];
      this.advance();
      while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
        value += this.input[this.position];
        this.advance();
      }
    }
    if (this.input[this.position] === 'e' || this.input[this.position] === 'E') {
      value += this.input[this.position];
      this.advance();
      if (this.input[this.position] === '+' || this.input[this.position] === '-') {
        value += this.input[this.position];
        this.advance();
      }
      while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
        value += this.input[this.position];
        this.advance();
      }
    }
    return this.createToken(TokenType.NUMBER, value, startPos, startLine, startColumn);
  }

  private readIdentifier(): DeukPackToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.position < this.input.length &&
      (this.isAlphaNumeric(this.input[this.position] || '') || (this.input[this.position] || '') === '_')) {
      value += this.input[this.position];
      this.advance();
    }
    // `[c#: …]` — `#` must not start a line comment inside the bracket attribute
    if (value === 'c' && this.position < this.input.length && this.input[this.position] === '#') {
      value += '#';
      this.advance();
    }
    const keywordType = this.keywords.get(value);
    if (keywordType) return this.createToken(keywordType, value, startPos, startLine, startColumn);
    return this.createToken(TokenType.IDENTIFIER, value, startPos, startLine, startColumn);
  }

  private readLineComment(): DeukPackToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    this.advance();
    if (this.input[this.position - 1] === '/' || this.input[this.position - 1] === '-') this.advance();
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      value += this.input[this.position];
      this.advance();
    }
    return this.createToken(TokenType.LINE_COMMENT, value, startPos, startLine, startColumn);
  }

  private readBlockComment(): DeukPackToken {
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
    return this.createToken(TokenType.BLOCK_COMMENT, value, startPos, startLine, startColumn);
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
  private isHexDigit(c: string): boolean {
    return this.isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }
  private isWhitespace(c: string): boolean {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r';
  }

  private createToken(type: TokenType, value: string, position: number, line: number, column: number): DeukPackToken {
    return { type, value, position, line, column };
  }
}
