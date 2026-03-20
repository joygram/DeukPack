/**
 * Protocol Buffers (.proto) AST builder. Builds DeukPackAST from ProtoLexer tokens.
 * message → struct, enum → enum, package → namespace; field number and type mapping to wire format.
 */

import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackField,
  DeukPackEnum,
  DeukPackNamespace,
  DeukPackType
} from '../types/DeukPackTypes';
import { ProtoToken, ProtoTokenType } from './ProtoTypes';

const PROTO_TYPE_TO_DEUKPACK: Record<string, string> = {
  int32: 'int32', int64: 'int64', uint32: 'int32', uint64: 'int64',
  sint32: 'int32', sint64: 'int64', fixed32: 'int32', fixed64: 'int64',
  sfixed32: 'int32', sfixed64: 'int64',
  float: 'float', double: 'double',
  string: 'string', bytes: 'binary', bool: 'bool'
};

export class ProtoASTBuilder {
  private tokens: ProtoToken[] = [];
  private position: number = 0;
  private currentFile: string = '';

  build(tokens: ProtoToken[], fileName: string): DeukPackAST {
    this.tokens = tokens;
    this.position = 0;
    this.currentFile = fileName;

    const ast: DeukPackAST = {
      namespaces: [],
      structs: [],
      enums: [],
      services: [],
      typedefs: [],
      constants: [],
      includes: []
    };

    while (!this.isAtEnd()) {
      const t = this.peek();
      switch (t.type) {
        case ProtoTokenType.PACKAGE:
          ast.namespaces.push(this.parsePackage());
          break;
        case ProtoTokenType.MESSAGE:
          ast.structs.push(this.parseMessage());
          break;
        case ProtoTokenType.ENUM:
          ast.enums.push(this.parseEnum());
          break;
        case ProtoTokenType.SYNTAX:
        case ProtoTokenType.OPTION:
          this.skipToNextStatement();
          break;
        case ProtoTokenType.IMPORT:
          ast.includes.push(this.parseImport());
          break;
        case ProtoTokenType.EOF:
          return ast;
        default:
          this.advance();
          break;
      }
    }
    return ast;
  }

  private peek(): ProtoToken {
    const t = this.tokens[this.position];
    if (t) return t;
    const last = this.tokens[this.tokens.length - 1];
    return last ?? { type: ProtoTokenType.EOF, value: '', position: 0, line: 1, column: 1 };
  }

  private advance(): ProtoToken {
    const t = this.tokens[this.position];
    if (this.position < this.tokens.length) this.position++;
    const fallback: ProtoToken = { type: ProtoTokenType.EOF, value: '', position: 0, line: 1, column: 1 };
    return t ?? this.tokens[this.tokens.length - 1] ?? fallback;
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length || this.peek().type === ProtoTokenType.EOF;
  }

  private expect(type: ProtoTokenType): ProtoToken {
    const t = this.peek();
    if (t.type !== type) throw new Error(`Expected ${type} at ${t.line}:${t.column}`);
    return this.advance();
  }

  private parseImport(): string {
    this.advance(); // import
    const path = this.expect(ProtoTokenType.STRING_LITERAL).value;
    this.optionalSemicolon();
    return path;
  }

  private parsePackage(): DeukPackNamespace {
    this.advance(); // package
    let name = this.expect(ProtoTokenType.IDENTIFIER).value;
    while (this.check(ProtoTokenType.DOT)) {
      this.advance();
      name += '.' + this.expect(ProtoTokenType.IDENTIFIER).value;
    }
    this.optionalSemicolon();
    return { language: '*', name };
  }

  private parseMessage(): DeukPackStruct {
    this.advance(); // message
    const name = this.expect(ProtoTokenType.IDENTIFIER).value;
    this.expect(ProtoTokenType.LEFT_BRACE);
    const fields: DeukPackField[] = [];
    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.check(ProtoTokenType.MESSAGE) || this.check(ProtoTokenType.ENUM)) {
        this.skipNestedDeclaration();
        continue;
      }
      if (this.check(ProtoTokenType.ONEOF)) {
        this.skipOneof();
        continue;
      }
      const field = this.parseField();
      if (field) fields.push(field);
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    const result: DeukPackStruct = { name, fields };
    result.sourceFile = this.currentFile;
    return result;
  }

  private parseField(): DeukPackField | null {
    let required = false;
    let repeated = false;
    if (this.check(ProtoTokenType.REQUIRED)) {
      required = true;
      this.advance();
    } else if (this.check(ProtoTokenType.OPTIONAL)) {
      this.advance();
    } else if (this.check(ProtoTokenType.REPEATED)) {
      repeated = true;
      this.advance();
    }

    let type: DeukPackType;
    if (this.check(ProtoTokenType.MAP)) {
      type = this.parseMapType();
    } else {
      type = this.parseProtoScalarOrUserType();
      if (repeated) type = { type: 'list', elementType: type } as unknown as DeukPackType;
    }
    const name = this.expect(ProtoTokenType.IDENTIFIER).value;
    this.expect(ProtoTokenType.EQUALS);
    const id = parseInt(this.expect(ProtoTokenType.NUMBER).value);
    this.optionalSemicolon();

    return { id, name, type, required };
  }

  private parseProtoScalarOrUserType(): DeukPackType {
    const raw = this.expect(ProtoTokenType.IDENTIFIER).value;
    const typeName = PROTO_TYPE_TO_DEUKPACK[raw];
    if (typeName) return typeName as DeukPackType;
    return raw as DeukPackType;
  }

  private parseMapType(): DeukPackType {
    this.advance(); // map
    this.expect(ProtoTokenType.LEFT_ANGLE);
    const keyType = this.parseProtoScalarOrUserType();
    this.expect(ProtoTokenType.COMMA);
    const valueType = this.parseProtoScalarOrUserType();
    this.expect(ProtoTokenType.RIGHT_ANGLE);
    return { type: 'map', keyType, valueType } as unknown as DeukPackType;
  }

  private parseEnum(): DeukPackEnum {
    this.advance(); // enum
    const name = this.expect(ProtoTokenType.IDENTIFIER).value;
    this.expect(ProtoTokenType.LEFT_BRACE);
    const values: { [key: string]: number } = {};
    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.check(ProtoTokenType.OPTION)) {
        this.skipToNextStatement();
        continue;
      }
      const id = this.expect(ProtoTokenType.IDENTIFIER).value;
      if (this.check(ProtoTokenType.EQUALS)) {
        this.advance();
        const num = parseInt(this.expect(ProtoTokenType.NUMBER).value);
        values[id] = num;
      } else {
        const nextVal = Object.keys(values).length === 0 ? 0 : Math.max(...Object.values(values)) + 1;
        values[id] = nextVal;
      }
      this.optionalSemicolon();
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    const result: DeukPackEnum = { name, values };
    result.sourceFile = this.currentFile;
    return result;
  }

  private check(type: ProtoTokenType): boolean {
    return this.peek().type === type;
  }

  private optionalSemicolon(): void {
    if (this.check(ProtoTokenType.SEMICOLON)) this.advance();
  }

  private skipToNextStatement(): void {
    while (!this.isAtEnd() && !this.check(ProtoTokenType.SEMICOLON) && !this.check(ProtoTokenType.RIGHT_BRACE) && this.peek().type !== ProtoTokenType.MESSAGE && this.peek().type !== ProtoTokenType.ENUM && this.peek().type !== ProtoTokenType.PACKAGE)
      this.advance();
    this.optionalSemicolon();
  }

  private skipNestedDeclaration(): void {
    if (this.check(ProtoTokenType.MESSAGE) || this.check(ProtoTokenType.ENUM)) {
      this.advance();
      this.expect(ProtoTokenType.IDENTIFIER);
      this.expect(ProtoTokenType.LEFT_BRACE);
      let depth = 1;
      while (depth > 0 && !this.isAtEnd()) {
        const t = this.advance();
        if (t.type === ProtoTokenType.LEFT_BRACE) depth++;
        else if (t.type === ProtoTokenType.RIGHT_BRACE) depth--;
      }
    }
  }

  private skipOneof(): void {
    this.advance(); // oneof
    this.expect(ProtoTokenType.IDENTIFIER);
    this.expect(ProtoTokenType.LEFT_BRACE);
    let depth = 1;
    while (depth > 0 && !this.isAtEnd()) {
      const t = this.advance();
      if (t.type === ProtoTokenType.LEFT_BRACE) depth++;
      else if (t.type === ProtoTokenType.RIGHT_BRACE) depth--;
    }
  }
}
