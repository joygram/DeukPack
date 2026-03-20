/**
 * IDL Lexer (.thrift-style source)
 * Same token types as DeukLexer for shared AST builder.
 */

import { DeukPackToken, TokenType } from '../types/DeukPackTypes';

export class IdlLexer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: DeukPackToken[] = [];

  // Keywords map for O(1) lookup
  private keywords: Map<string, TokenType> = new Map([
    ['namespace', TokenType.NAMESPACE],
    ['struct', TokenType.RECORD],
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
    ['double', TokenType.DOUBLE],
    ['string', TokenType.STRING],
    ['binary', TokenType.BINARY],
    ['list', TokenType.LIST],
    ['set', TokenType.SET],
    ['map', TokenType.MAP],
    ['tablelink', TokenType.TABLELINK]
  ]);

  /**
   * Tokenize IDL input string
   */
  tokenize(input: string): DeukPackToken[] {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();

      if (this.position >= this.input.length) {
        break;
      }

      const token = this.nextToken();
      if (token && token.type !== TokenType.WHITESPACE) {
        this.tokens.push(token);
      }
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
      case '=':
        this.advance();
        return this.createToken(TokenType.EQUALS, '=', startPos, startLine, startColumn);
      case ':':
        this.advance();
        return this.createToken(TokenType.COLON, ':', startPos, startLine, startColumn);
      case ';':
        this.advance();
        return this.createToken(TokenType.SEMICOLON, ';', startPos, startLine, startColumn);
      case ',':
        this.advance();
        return this.createToken(TokenType.COMMA, ',', startPos, startLine, startColumn);
      case '.':
        this.advance();
        return this.createToken(TokenType.DOT, '.', startPos, startLine, startColumn);
      case '*':
        this.advance();
        return this.createToken(TokenType.ASTERISK, '*', startPos, startLine, startColumn);
      case '{':
        this.advance();
        return this.createToken(TokenType.LEFT_BRACE, '{', startPos, startLine, startColumn);
      case '}':
        this.advance();
        return this.createToken(TokenType.RIGHT_BRACE, '}', startPos, startLine, startColumn);
      case '[':
        this.advance();
        return this.createToken(TokenType.LEFT_BRACKET, '[', startPos, startLine, startColumn);
      case ']':
        this.advance();
        return this.createToken(TokenType.RIGHT_BRACKET, ']', startPos, startLine, startColumn);
      case '<':
        this.advance();
        return this.createToken(TokenType.LEFT_BRACKET, '<', startPos, startLine, startColumn);
      case '>':
        this.advance();
        return this.createToken(TokenType.RIGHT_BRACKET, '>', startPos, startLine, startColumn);
      case '(':
        this.advance();
        return this.createToken(TokenType.LEFT_PAREN, '(', startPos, startLine, startColumn);
      case ')':
        this.advance();
        return this.createToken(TokenType.RIGHT_PAREN, ')', startPos, startLine, startColumn);
    }

    if (char === '"' || char === "'") return this.readStringLiteral();
    if (this.isDigit(char)) return this.readNumber();
    if (this.isAlpha(char) || char === '_') return this.readIdentifier();
    if (char === '/' && this.peek() === '/') return this.readLineComment();
    if (char === '/' && this.peek() === '*') return this.readBlockComment();
    if (char === '#') return this.readLineComment();

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
    const char = this.input[this.position] || '';
    this.advance();
    switch (char) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '\\': return '\\';
      case '"': return '"';
      case "'": return "'";
      default: return char || '';
    }
  }

  private readNumber(): DeukPackToken {
    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
      value += this.input[this.position];
      this.advance();
    }
    if (this.position < this.input.length && this.input[this.position] === '.') {
      value += '.';
      this.advance();
      while (this.position < this.input.length && this.isDigit(this.input[this.position] || '')) {
        value += this.input[this.position];
        this.advance();
      }
    }
    if (this.position < this.input.length && (this.input[this.position] === 'e' || this.input[this.position] === 'E')) {
      value += this.input[this.position];
      this.advance();
      if (this.position < this.input.length && (this.input[this.position] === '+' || this.input[this.position] === '-')) {
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
    if (this.input[this.position - 1] === '/') this.advance();
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
      if (this.input[this.position] === '\n') { this.line++; this.column = 1; } else { this.column++; }
      this.position++;
    }
  }

  private advance(): void {
    if (this.position < this.input.length) {
      if (this.input[this.position] === '\n') { this.line++; this.column = 1; } else { this.column++; }
      this.position++;
    }
  }

  private peek(): string | null {
    return this.position + 1 < this.input.length ? this.input[this.position + 1] || '' : null;
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean { return this.isAlpha(char) || this.isDigit(char); }

  private isDigit(char: string): boolean { return char >= '0' && char <= '9'; }

  private isWhitespace(char: string): boolean { return char === ' ' || char === '\t' || char === '\n' || char === '\r'; }

  private createToken(type: TokenType, value: string, position: number, line: number, column: number): DeukPackToken {
    return { type, value, position, line, column };
  }
}
