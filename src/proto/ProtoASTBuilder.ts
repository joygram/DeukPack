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
  private nameStack: string[] = [];

  build(tokens: ProtoToken[], fileName: string): DeukPackAST {
    this.tokens = tokens;
    this.position = 0;
    this.currentFile = fileName;
    this.nameStack = [];

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
      this.skipIgnoredTokens();
      if (this.isAtEnd()) break;

      const t = this.peek();
      switch (t.type) {
        case ProtoTokenType.PACKAGE:
          ast.namespaces.push(this.parsePackage());
          break;
        case ProtoTokenType.MESSAGE:
          this.parseMessage(ast);
          break;
        case ProtoTokenType.ENUM:
          this.parseEnum(ast);
          break;
        case ProtoTokenType.IMPORT:
          ast.includes.push(this.parseImport());
          break;
        case ProtoTokenType.SERVICE:
          ast.services.push(this.parseService());
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

  private skipIgnoredTokens(): void {
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.type === ProtoTokenType.SYNTAX || t.type === ProtoTokenType.OPTION || t.type === ProtoTokenType.SEMICOLON) {
        this.skipToNextStatement();
        continue;
      }
      if (t.type === ProtoTokenType.LINE_COMMENT || t.type === ProtoTokenType.BLOCK_COMMENT) {
        // We skip stand-alone comments here, but they will be picked up by consumeLeadingComment
        this.advance();
        continue;
      }
      break;
    }
  }

  private consumeLeadingComment(): string | undefined {
    let pos = this.position - 1;
    const comments: string[] = [];
    while (pos >= 0) {
      const t = this.tokens[pos];
      if (!t) break;
      if (t.type === ProtoTokenType.LINE_COMMENT || t.type === ProtoTokenType.BLOCK_COMMENT) {
        comments.unshift(t.value.trim());
        pos--;
      } else if (t.type === ProtoTokenType.SEMICOLON || t.type === ProtoTokenType.LEFT_BRACE || t.type === ProtoTokenType.RIGHT_BRACE || t.type === ProtoTokenType.RIGHT_ANGLE) {
        break;
      } else {
        // Any other non-whitespace token breaks the block of potential doc comments
        break;
      }
    }
    return comments.length > 0 ? comments.join('\n') : undefined;
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
    let name = this.consumeIdentifier();
    while (this.check(ProtoTokenType.DOT)) {
      this.advance();
      name += '.' + this.consumeIdentifier();
    }
    this.optionalSemicolon();
    return { language: '*', name };
  }

  private parseMessage(ast: DeukPackAST): void {
    const docComment = this.consumeLeadingComment();
    this.advance(); // message
    const name = this.consumeIdentifier();
    
    // Manage name nesting
    this.nameStack.push(name);
    const fullName = this.nameStack.join('_');

    this.expect(ProtoTokenType.LEFT_BRACE);
    const fields: DeukPackField[] = [];
    
    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      this.skipIgnoredTokens();
      if (this.check(ProtoTokenType.RIGHT_BRACE)) break;

      if (this.check(ProtoTokenType.MESSAGE)) {
        this.parseMessage(ast);
        continue;
      }
      if (this.check(ProtoTokenType.ENUM)) {
        this.parseEnum(ast);
        continue;
      }
      if (this.check(ProtoTokenType.ONEOF)) {
        this.parseOneof(fields);
        continue;
      }
      if (this.check(ProtoTokenType.SEMICOLON)) {
        this.advance();
        continue;
      }
      if (this.check(ProtoTokenType.OPTION)) {
        this.skipToNextStatement();
        continue;
      }

      const field = this.parseField();
      if (field) fields.push(field);
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    this.optionalSemicolon();

    const result: DeukPackStruct = { name: fullName, fields };
    result.sourceFile = this.currentFile;
    if (docComment) result.docComment = docComment;
    ast.structs.push(result);
    
    this.nameStack.pop();
  }

  private parseOneof(fields: DeukPackField[]): void {
    this.advance(); // oneof
    this.consumeIdentifier(); // name
    this.expect(ProtoTokenType.LEFT_BRACE);
    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      this.skipIgnoredTokens();
      if (this.check(ProtoTokenType.RIGHT_BRACE)) break;
      const field = this.parseField();
      if (field) fields.push(field);
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    this.optionalSemicolon();
  }

  private parseField(): DeukPackField | null {
    const docComment = this.consumeLeadingComment();
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
    const name = this.consumeIdentifier();
    this.expect(ProtoTokenType.EQUALS);
    const id = parseInt(this.expect(ProtoTokenType.NUMBER).value);
    this.optionalSemicolon();

    const field: DeukPackField = { id, name, type, required };
    if (docComment) field.docComment = docComment;
    return field;
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

  private parseEnum(ast: DeukPackAST): void {
    const docComment = this.consumeLeadingComment();
    this.advance(); // enum
    const name = this.consumeIdentifier();
    
    this.nameStack.push(name);
    const fullName = this.nameStack.join('_');

    this.expect(ProtoTokenType.LEFT_BRACE);
    const values: { [key: string]: number } = {};
    const valueComments: { [key: string]: string } = {};

    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      this.skipIgnoredTokens();
      if (this.check(ProtoTokenType.RIGHT_BRACE)) break;

      if (this.check(ProtoTokenType.OPTION) || this.check(ProtoTokenType.SEMICOLON)) {
        this.skipToNextStatement();
        continue;
      }
      
      const valDocComment = this.consumeLeadingComment();
      const valId = this.consumeIdentifier();
      if (this.check(ProtoTokenType.EQUALS)) {
        this.advance();
        const num = parseInt(this.expect(ProtoTokenType.NUMBER).value);
        values[valId] = num;
      } else {
        const nextVal = Object.keys(values).length === 0 ? 0 : Math.max(...Object.values(values)) + 1;
        values[valId] = nextVal;
      }
      
      if (valDocComment) valueComments[valId] = valDocComment;
      this.optionalSemicolon();
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    this.optionalSemicolon();

    const result: DeukPackEnum = { name: fullName, values, valueComments };
    result.sourceFile = this.currentFile;
    if (docComment) result.docComment = docComment;
    ast.enums.push(result);
    
    this.nameStack.pop();
  }

  private parseService(): any {
    const docComment = this.consumeLeadingComment();
    this.advance(); // service
    const name = this.consumeIdentifier();
    this.expect(ProtoTokenType.LEFT_BRACE);
    const methods: any[] = [];
    while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      this.skipIgnoredTokens();
      if (this.check(ProtoTokenType.RIGHT_BRACE)) break;
      if (this.check(ProtoTokenType.RPC)) {
        methods.push(this.parseRPC());
      } else {
        this.advance();
      }
    }
    this.expect(ProtoTokenType.RIGHT_BRACE);
    this.optionalSemicolon();
    return { name, methods, docComment, sourceFile: this.currentFile };
  }

  private parseRPC(): any {
    const docComment = this.consumeLeadingComment();
    this.advance(); // rpc
    const name = this.consumeIdentifier();
    this.expect(ProtoTokenType.LEFT_BRACKET); // (
    const inputType = this.consumeIdentifier();
    this.expect(ProtoTokenType.RIGHT_BRACKET); // )
    this.expect(ProtoTokenType.RETURNS);
    this.expect(ProtoTokenType.LEFT_BRACKET); // (
    const outputType = this.consumeIdentifier();
    this.expect(ProtoTokenType.RIGHT_BRACKET); // )
    
    if (this.check(ProtoTokenType.LEFT_BRACE)) {
      this.advance();
      while (!this.check(ProtoTokenType.RIGHT_BRACE) && !this.isAtEnd()) {
        this.advance();
      }
      this.expect(ProtoTokenType.RIGHT_BRACE);
    } else {
      this.optionalSemicolon();
    }
    
    return { 
      name, 
      docComment, 
      returnType: outputType, 
      parameters: [{ id: 1, name: 'req', type: inputType, required: true }] 
    };
  }

  private consumeIdentifier(): string {
    const t = this.peek();
    const allowed = [
      ProtoTokenType.IDENTIFIER,
      ProtoTokenType.MESSAGE,
      ProtoTokenType.ENUM,
      ProtoTokenType.ONEOF,
      ProtoTokenType.MAP,
      ProtoTokenType.SERVICE,
      ProtoTokenType.RPC,
      ProtoTokenType.PACKAGE,
      ProtoTokenType.IMPORT,
      ProtoTokenType.OPTION
    ];
    if (allowed.includes(t.type)) {
      return this.advance().value;
    }
    throw new Error(`Expected IDENTIFIER, got ${t.type} (value: "${t.value}") at ${t.line}:${t.column}`);
  }

  private check(type: ProtoTokenType): boolean {
    return this.peek().type === type;
  }

  private optionalSemicolon(): void {
    if (this.check(ProtoTokenType.SEMICOLON)) this.advance();
  }

  private skipToNextStatement(): void {
    while (!this.isAtEnd() && !this.check(ProtoTokenType.SEMICOLON) && !this.check(ProtoTokenType.RIGHT_BRACE) && 
           this.peek().type !== ProtoTokenType.MESSAGE && this.peek().type !== ProtoTokenType.ENUM && 
           this.peek().type !== ProtoTokenType.PACKAGE && this.peek().type !== ProtoTokenType.SERVICE)
      this.advance();
    this.optionalSemicolon();
  }

}
