/**
 * DeukPack AST Builder
 * Builds Abstract Syntax Tree from tokens
 */

import { parseDeukNumericLiteral } from '../core/parseDeukNumericLiteral';
import { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackService, DeukPackMethod, DeukPackField, DeukPackNamespace, DeukPackToken, TokenType, DeukPackType, DeukPackMapType, DeukPackException } from '../types/DeukPackTypes';

export interface DeukPackASTBuilderOptions {
  /** When true, parse .deuk field syntax: id> [Attr]… type name [= default] and single-identifier namespace */
  deuk?: boolean;
  /** When false (default), throw if more than one namespace is defined in a single file. */
  allowMultiNamespace?: boolean;
}

export class DeukPackASTBuilder {
  private tokens: DeukPackToken[] = [];
  private position: number = 0;
  private currentFile: string = '';
  /** Collected doc comments for the next declaration (struct/enum/field etc.) */
  private leadingCommentBuffer: string = '';
  private deukMode: boolean = false;

  /** Lowercase names after `[` that are neutral IDL tags (not C# passthrough). See DEUKPACK_IDL_DECLARATION_ATTRIBUTES_DESIGN.md */
  private static readonly NEUTRAL_DEUK_BRACKET_NAMES = new Set([
    'table',
    'key',
    'unique',
    'index',
    'fk',
    'schema',
    'deprecated',
    'doc',
    'sensitive',
    'redact',
    'storage'
  ]);

  /**
   * 공식 IDL 스펙에 포함하지 않는 `[]` 이름: 토큰만 소비하고 AST(중립 태그·C# 어트리뷰트)에는 넣지 않음.
   * 레거시/실수 흡수용. 선언 종류(record/entity/message)별 허용 태그 해석은 파서와 별도(코드젠·정책).
   */
  private static readonly NON_OFFICIAL_BRACKET_SKIP_FIRST = new Set(['column', 'maxlength']);

  /**
   * Collect consecutive LINE_COMMENT/BLOCK_COMMENT tokens and return combined text (trimmed). Consumes tokens.
   */
  private collectLeadingComments(): string {
    const parts: string[] = [];
    while (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
      const t = this.advance();
      const text = (t.value || '').trim();
      if (text) parts.push(text);
    }
    return parts.join('\n').trim();
  }

  /**
   * Split leading comment into docComment and C# attribute lines.
   * Lines that look like [AttrName] or [AttrName("arg")] are treated as csharpAttributes (DeukPack extension).
   */
  private parseDocCommentAndCSharpAttributes(comment: string): { docComment?: string; csharpAttributes?: string[] } {
    if (!comment || !comment.trim()) return {};
    const attrLineRe = /^\[.+\]$/;
    const docLines: string[] = [];
    const attrLines: string[] = [];
    for (const line of comment.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (attrLineRe.test(trimmed)) {
        attrLines.push(trimmed);
      } else {
        docLines.push(line);
      }
    }
    const out: { docComment?: string; csharpAttributes?: string[] } = {};
    if (docLines.length) out.docComment = docLines.join('\n').trim();
    if (attrLines.length) out.csharpAttributes = attrLines;
    return out;
  }

  /**
   * Parse IDL annotations: ( key = "value", key2 = "value2" ) or ( key ). Consumes tokens.
   */
  private tryParseAnnotations(): { [key: string]: string } | undefined {
    if (!this.check(TokenType.LEFT_PAREN)) return undefined;
    this.advance();
    const ann: { [key: string]: string } = {};
    while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
      const keyTok = this.peek();
      const key = (keyTok.type === TokenType.IDENTIFIER || keyTok.type === TokenType.TABLE ||
        keyTok.type === TokenType.RECORD || keyTok.type === TokenType.ENTITY ||
        keyTok.type === TokenType.REQUIRED || keyTok.type === TokenType.OPTIONAL)
        ? this.advance().value
        : this.expect(TokenType.IDENTIFIER).value;
      let val = 'true';
      if (this.check(TokenType.EQUALS)) {
        this.advance();
        if (this.check(TokenType.STRING_LITERAL)) {
          val = this.advance().value;
        } else if (this.check(TokenType.IDENTIFIER)) {
          val = this.advance().value;
        } else if (this.check(TokenType.NUMBER)) {
          val = this.advance().value;
        }
      }
      ann[key] = val;
      if (this.check(TokenType.COMMA)) this.advance();
    }
    if (this.check(TokenType.RIGHT_PAREN)) this.advance();
    return Object.keys(ann).length ? ann : undefined;
  }

  /**
   * Build AST from tokens
   */
  build(tokens: DeukPackToken[], fileName: string, options?: DeukPackASTBuilderOptions): DeukPackAST {
    this.tokens = tokens;
    this.position = 0;
    this.currentFile = fileName;
    this.leadingCommentBuffer = '';
    this.deukMode = options?.deuk ?? false;
    (this as any).allowMultiNamespace = options?.allowMultiNamespace ?? false;

    const ast: DeukPackAST = {
      namespaces: [],
      structs: [],
      enums: [],
      services: [],
      typedefs: [],
      constants: [],
      includes: [],
      annotations: {}
    };

    while (!this.isAtEnd()) {
      const token = this.peek();

      switch (token.type) {
        case TokenType.NAMESPACE: {
          if (!(this as any).allowMultiNamespace && ast.namespaces.length > 0) {
            throw new DeukPackException(`Multiple namespaces found in ${this.currentFile}. Use --allow-multi-namespace to permit this.`, this.peek()?.line, this.peek()?.column, this.currentFile);
          }
          this.leadingCommentBuffer = '';
          const namespace = this.parseNamespace();
          namespace.sourceFile = this.currentFile;
          ast.namespaces.push(namespace);
          break;
        }
        case TokenType.RECORD: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const struct = this.parseStruct(doc, 'record');
          struct.sourceFile = this.currentFile;
          ast.structs.push(struct);
          break;
        }
        case TokenType.ENTITY: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const struct = this.parseStruct(doc, 'entity');
          struct.sourceFile = this.currentFile;
          ast.structs.push(struct);
          break;
        }
        case TokenType.IDENTIFIER:
          if (token.value === 'message') {
            const doc = this.leadingCommentBuffer;
            this.leadingCommentBuffer = '';
            const next = this.tokens[this.position + 1];
            const struct =
              next?.type === TokenType.LEFT_BRACKET
                ? this.parseMessage(doc)
                : this.parseMessageLegacy(doc);
            struct.sourceFile = this.currentFile;
            ast.structs.push(struct);
          } else {
            this.leadingCommentBuffer = '';
            this.advance();
          }
          break;
        case TokenType.ENUM: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const enumDef = this.parseEnum(doc);
          enumDef.sourceFile = this.currentFile;
          ast.enums.push(enumDef);
          break;
        }
        case TokenType.SERVICE: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const service = this.parseService(doc);
          service.sourceFile = this.currentFile;
          ast.services.push(service);
          break;
        }
        case TokenType.INCLUDE:
          this.leadingCommentBuffer = '';
          ast.includes.push(this.parseInclude());
          break;
        case TokenType.TYPEDEF: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const typedef = this.parseTypedef(doc);
          typedef.sourceFile = this.currentFile;
          ast.typedefs.push(typedef);
          break;
        }
        case TokenType.CONST: {
          const doc = this.leadingCommentBuffer;
          this.leadingCommentBuffer = '';
          const constant = this.parseConst(doc);
          constant.sourceFile = this.currentFile;
          ast.constants.push(constant);
          break;
        }
        case TokenType.TABLE: {
          this.leadingCommentBuffer = '';
          const tableStruct = this.parseTableDefinition();
          tableStruct.sourceFile = this.currentFile;
          ast.structs.push(tableStruct);
          break;
        }
        case TokenType.LINE_COMMENT:
        case TokenType.BLOCK_COMMENT:
          this.leadingCommentBuffer = this.collectLeadingComments();
          break;
        default:
          this.leadingCommentBuffer = '';
          this.advance();
          break;
      }
    }

    return ast;
  }

  /**
   * Parse namespace declaration
   */
  private parseNamespace(): DeukPackNamespace {
    this.advance(); // consume 'namespace'

    if (this.deukMode) {
      let name = this.expect(TokenType.IDENTIFIER).value;
      while (this.check(TokenType.DOT)) {
        this.advance();
        name += '.' + this.expect(TokenType.IDENTIFIER).value;
      }
      return { language: '*', name };
    }

    // Handle namespace * syntax
    let language = '*';
    if (this.check(TokenType.ASTERISK)) {
      this.advance(); // consume '*'
    } else {
      language = this.expect(TokenType.IDENTIFIER).value;
    }
    const name = this.expect(TokenType.IDENTIFIER).value;
    return { language, name };
  }

  /**
   * Parse struct declaration
   */
  private parseStruct(docComment?: string, declarationKind: 'record' | 'entity' = 'record'): DeukPackStruct {
    this.advance(); // consume 'struct' | 'record' | 'entity'

    const name = this.expect(TokenType.IDENTIFIER).value;

    // extends BaseStruct
    let extendsName: string | undefined;
    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'extends') {
      this.advance(); // consume 'extends'
      extendsName = this.expect(TokenType.IDENTIFIER).value;
    }

    const structBracketCsharp: string[] = [];
    const structBracketNeutral: string[] = [];
    while (this.deukMode && this.check(TokenType.LEFT_BRACKET) && this.peek().value === '[') {
      const pair = this.parseOneDeukInlineBracketPair();
      structBracketCsharp.push(...pair.csharp);
      structBracketNeutral.push(...pair.neutral);
    }

    const annotations = this.tryParseAnnotations();

    while (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
      this.advance();
    }

    this.expect(TokenType.LEFT_BRACE);

    const fields: DeukPackField[] = [];
    while (!this.check(TokenType.RIGHT_BRACE)) {
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance();
        continue;
      }

      const field = this.parseField();
      if (field) {
        fields.push(field);
      }
    }

    this.expect(TokenType.RIGHT_BRACE);

    const result: DeukPackStruct = { name, fields, declarationKind };
    if (extendsName) result.extends = extendsName;
    if (structBracketNeutral.length) result.deukBracketAttributes = structBracketNeutral;
    if (docComment) {
      const parsed = this.parseDocCommentAndCSharpAttributes(docComment);
      if (parsed.docComment) result.docComment = parsed.docComment;
      if (structBracketCsharp.length || parsed.csharpAttributes?.length) {
        result.csharpAttributes = [...structBracketCsharp, ...(parsed.csharpAttributes ?? [])];
      }
    } else if (structBracketCsharp.length) {
      result.csharpAttributes = [...structBracketCsharp];
    }
    if (annotations) result.annotations = annotations;
    if (annotations && annotations['key']) {
      const raw = String(annotations['key']).replace(/^["']|["']$/g, '').trim();
      if (raw) {
        result.keyFieldNames = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return result;
  }

  /** 예약 필드 ID: message<> 자동 주입 msgInfo (IDL에는 적지 않음, 코드젠에서만 사용). DEUKPACK_MESSAGE_INFO_KEYWORD §5. */
  private static readonly MSGINFO_FIELD_ID = 31000;

  /**
   * Parse message<id> name { fields } — 득팩 프로토콜 메시지.
   * IDL에는 사용자 필드만 적고, 파서가 예약 ID(31000)로 msgInfo 필드를 자동 주입.
   */
  private parseMessage(docComment?: string): DeukPackStruct {
    this.advance(); // consume 'message'
    this.expect(TokenType.LEFT_BRACKET);
    const msgIdStr = this.expect(TokenType.NUMBER).value;
    this.expect(TokenType.RIGHT_BRACKET);
    const name = this.expect(TokenType.IDENTIFIER).value;
    const msgBracketCsharp: string[] = [];
    const msgBracketNeutral: string[] = [];
    while (this.deukMode && this.check(TokenType.LEFT_BRACKET) && this.peek().value === '[') {
      const pair = this.parseOneDeukInlineBracketPair();
      msgBracketCsharp.push(...pair.csharp);
      msgBracketNeutral.push(...pair.neutral);
    }
    const annotations = this.tryParseAnnotations();

    while (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
      this.advance();
    }

    this.expect(TokenType.LEFT_BRACE);

    const userFields: DeukPackField[] = [];
    while (!this.check(TokenType.RIGHT_BRACE)) {
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance();
        continue;
      }
      const field = this.parseField();
      if (field) userFields.push(field);
    }

    this.expect(TokenType.RIGHT_BRACE);

    const syntheticMsgInfo: DeukPackField = {
      id: DeukPackASTBuilder.MSGINFO_FIELD_ID as any,
      name: 'msgInfo',
      type: 'MsgInfo' as any,
      required: false,
      annotations: { msgId: msgIdStr }
    };
    const fields = [syntheticMsgInfo, ...userFields];

    const result: DeukPackStruct = { name, fields, declarationKind: 'message' };
    if (msgBracketNeutral.length) result.deukBracketAttributes = msgBracketNeutral;
    if (docComment) {
      const parsed = this.parseDocCommentAndCSharpAttributes(docComment);
      if (parsed.docComment) result.docComment = parsed.docComment;
      if (msgBracketCsharp.length || parsed.csharpAttributes?.length) {
        result.csharpAttributes = [...msgBracketCsharp, ...(parsed.csharpAttributes ?? [])];
      }
    } else if (msgBracketCsharp.length) {
      result.csharpAttributes = [...msgBracketCsharp];
    }
    if (annotations) result.annotations = annotations;
    result.annotations = result.annotations ?? {};
    result.annotations['msgId'] = msgIdStr;
    return result;
  }

  /**
   * Thrift→.deuk 마이그레이션 레거시: message name { ... } (괄호 numeric ID 없음).
   * MsgInfo 기본값·DefaultMessageId는 코드젠이 query_msg_id 등에서 보완하거나 0으로 둔다.
   */
  private parseMessageLegacy(docComment?: string): DeukPackStruct {
    this.advance(); // consume 'message'
    const msgIdStr = '0';
    const name = this.expect(TokenType.IDENTIFIER).value;
    const legBracketCsharp: string[] = [];
    const legBracketNeutral: string[] = [];
    while (this.deukMode && this.check(TokenType.LEFT_BRACKET) && this.peek().value === '[') {
      const pair = this.parseOneDeukInlineBracketPair();
      legBracketCsharp.push(...pair.csharp);
      legBracketNeutral.push(...pair.neutral);
    }
    const annotations = this.tryParseAnnotations();

    while (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
      this.advance();
    }

    this.expect(TokenType.LEFT_BRACE);

    const userFields: DeukPackField[] = [];
    while (!this.check(TokenType.RIGHT_BRACE)) {
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance();
        continue;
      }
      const field = this.parseField();
      if (field) userFields.push(field);
    }

    this.expect(TokenType.RIGHT_BRACE);

    const syntheticMsgInfo: DeukPackField = {
      id: DeukPackASTBuilder.MSGINFO_FIELD_ID as any,
      name: 'msgInfo',
      type: 'MsgInfo' as any,
      required: false,
      annotations: { msgId: msgIdStr }
    };
    const fields = [syntheticMsgInfo, ...userFields];

    const result: DeukPackStruct = { name, fields, declarationKind: 'message' };
    if (legBracketNeutral.length) result.deukBracketAttributes = legBracketNeutral;
    if (docComment) {
      const parsed = this.parseDocCommentAndCSharpAttributes(docComment);
      if (parsed.docComment) result.docComment = parsed.docComment;
      if (legBracketCsharp.length || parsed.csharpAttributes?.length) {
        result.csharpAttributes = [...legBracketCsharp, ...(parsed.csharpAttributes ?? [])];
      }
    } else if (legBracketCsharp.length) {
      result.csharpAttributes = [...legBracketCsharp];
    }
    if (annotations) result.annotations = annotations;
    result.annotations = result.annotations ?? {};
    result.annotations['msgId'] = msgIdStr;
    return result;
  }

  /**
   * Parse table<rowType> = { version: "...", key?: "..." } — 득팩 테이블 정의.
   * Produces a synthetic struct named "table" with header + infos for existing codegen (IDeukMetaContainer).
   */
  private parseTableDefinition(): DeukPackStruct {
    this.advance(); // consume 'table'
    this.expect(TokenType.LEFT_BRACKET);
    const rowTypeName = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.RIGHT_BRACKET);
    this.expect(TokenType.EQUALS);
    this.expect(TokenType.LEFT_BRACE);

    const annotations: { [key: string]: string } = {};
    let keyFieldNames: string[] | undefined;

    while (!this.check(TokenType.RIGHT_BRACE)) {
      const key = this.expect(TokenType.IDENTIFIER).value;
      this.expect(TokenType.COLON);
      if (this.check(TokenType.STRING_LITERAL)) {
        const val = this.advance().value;
        const unquoted = val.replace(/^["']|["']$/g, '').trim();
        if (key === 'version') annotations['version'] = unquoted;
        else if (key === 'key') keyFieldNames = [unquoted];
      } else if (this.check(TokenType.LEFT_BRACKET)) {
        this.advance();
        const list: string[] = [];
        while (!this.check(TokenType.RIGHT_BRACKET)) {
          const t = this.expect(TokenType.IDENTIFIER);
          list.push(t.value);
          if (this.check(TokenType.COMMA)) this.advance();
        }
        this.expect(TokenType.RIGHT_BRACKET);
        if (key === 'key') keyFieldNames = list;
      }
      if (this.check(TokenType.COMMA)) this.advance();
    }
    this.expect(TokenType.RIGHT_BRACE);

    // 테이블 헤더 타입명: 프로젝트 IDL에 해당 이름의 record/typedef 필요. 레거시 호환용 기본명.
    const headerType = 'MetaHeader' as DeukPackType;
    const infosType: DeukPackMapType = {
      type: 'map',
      keyType: 'int64' as DeukPackType,
      valueType: rowTypeName as DeukPackType
    };

    const tableStruct: DeukPackStruct = {
      name: 'container',
      declarationKind: 'table',
      fields: [
        { id: 1, name: 'header', type: headerType, required: false },
        { id: 2, name: 'infos', type: infosType as unknown as DeukPackType, required: false }
      ]
    };
    if (Object.keys(annotations).length) tableStruct.annotations = annotations;
    if (keyFieldNames?.length) tableStruct.keyFieldNames = keyFieldNames;
    return tableStruct;
  }

  /**
   * Parse field declaration. Deuk: id> [Attr]… type name [= default]. Legacy .thrift: id: [required|optional] type name [= default]
   */
  private parseField(): DeukPackField | null {
    const rawComment = this.collectLeadingComments();

    if (this.check(TokenType.RIGHT_BRACE)) {
      return null;
    }

    const id = parseInt(this.expect(TokenType.NUMBER).value);

    if (this.deukMode) {
      this.expect(TokenType.RIGHT_BRACKET); // '>'
      const inlineCsharp: string[] = [];
      const inlineNeutral: string[] = [];
      while (this.check(TokenType.LEFT_BRACKET) && this.peek().value === '[') {
        const pair = this.parseOneDeukInlineBracketPair();
        inlineCsharp.push(...pair.csharp);
        inlineNeutral.push(...pair.neutral);
      }
      let required = false;
      if (this.check(TokenType.REQUIRED)) {
        required = true;
        this.advance();
      } else if (this.check(TokenType.OPTIONAL)) {
        this.advance();
      }
      const type = this.parseType();
      const name = this.expect(TokenType.IDENTIFIER).value;
      let defaultValue: any = undefined;
      if (this.check(TokenType.EQUALS)) {
        this.advance();
        defaultValue = this.parseDefaultValue();
      }
      if (this.check(TokenType.COMMA)) this.advance();
      if (this.check(TokenType.SEMICOLON)) this.advance();
      const result: DeukPackField = { id, name, type, required };
      if (defaultValue !== undefined) result.defaultValue = defaultValue;
      if (rawComment) {
        const parsed = this.parseDocCommentAndCSharpAttributes(rawComment);
        if (parsed.docComment) result.docComment = parsed.docComment;
        if (parsed.csharpAttributes?.length) result.csharpAttributes = parsed.csharpAttributes;
      }
      if (inlineCsharp.length) {
        result.csharpAttributes = result.csharpAttributes || [];
        result.csharpAttributes.push(...inlineCsharp);
      }
      if (inlineNeutral.length) result.deukBracketAttributes = inlineNeutral;
      return result;
    }

    this.expect(TokenType.COLON);
    let required = false;
    if (this.check(TokenType.REQUIRED)) {
      required = true;
      this.advance();
    } else if (this.check(TokenType.OPTIONAL)) {
      this.advance();
    }
    const type = this.parseType();
    const name = this.expect(TokenType.IDENTIFIER).value;
    const annotations = this.tryParseAnnotations();
    let defaultValue: any = undefined;
    if (this.check(TokenType.EQUALS)) {
      this.advance();
      defaultValue = this.parseDefaultValue();
    }
    if (this.check(TokenType.COMMA)) this.advance();
    if (this.check(TokenType.SEMICOLON)) this.advance();
    const result: DeukPackField = { id, name, type, required };
    if (defaultValue !== undefined) result.defaultValue = defaultValue;
    if (rawComment) {
      const parsed = this.parseDocCommentAndCSharpAttributes(rawComment);
      if (parsed.docComment) result.docComment = parsed.docComment;
      if (parsed.csharpAttributes?.length) result.csharpAttributes = parsed.csharpAttributes;
    }
    if (annotations) result.annotations = annotations;
    return result;
  }

  /** Rebuild source fragment for bracket bodies; string literals need quotes for `[c#: Obsolete("x")]`. */
  private deukBracketTokenFragment(t: DeukPackToken): string {
    if (t.type === TokenType.STRING_LITERAL) {
      return JSON.stringify(t.value);
    }
    return t.value;
  }

  /** Collect inner text until `]` at parenthesis depth 0 (bracket body for `[c#: …]` and `:value`). */
  private consumeDeukBracketInnerUntilRightBracket(): string {
    let depth = 0;
    let s = '';
    while (!this.isAtEnd()) {
      if (this.check(TokenType.RIGHT_BRACKET) && depth === 0) {
        return s;
      }
      if (this.check(TokenType.LEFT_PAREN)) {
        depth++;
        s += '(';
        this.advance();
        continue;
      }
      if (this.check(TokenType.RIGHT_PAREN)) {
        depth--;
        s += ')';
        this.advance();
        continue;
      }
      const t = this.advance();
      s += this.deukBracketTokenFragment(t);
    }
    const cur = this.peek();
    throw new Error(`Unclosed '[' attribute at line ${cur.line}, column ${cur.column}`);
  }

  /** First token of `[name…]` — `table` etc. are keywords, not IDENTIFIER. */
  private parseDeukBracketFirstName(): string {
    const t = this.peek();
    if (
      t.type === TokenType.IDENTIFIER ||
      t.type === TokenType.TABLE ||
      t.type === TokenType.RECORD ||
      t.type === TokenType.ENTITY ||
      t.type === TokenType.REQUIRED ||
      t.type === TokenType.OPTIONAL
    ) {
      return this.advance().value;
    }
    throw new Error(
      `Expected name token in '[]' attribute, got ${t.type} (value: "${t.value}") at line ${t.line}, column ${t.column}`
    );
  }

  private neutralDeukBracketBaseName(piece: string): string {
    const head = piece.split(':')[0] ?? piece;
    return (head.split('(')[0] ?? head).trim().toLowerCase();
  }

  /**
   * Parse one `[…]` block in .deuk: `[c#: …]` / `[csharp: …]` → csharp; neutral tags → neutral; else → csharpAttributes shape.
   */
  private parseOneDeukInlineBracketPair(): { csharp: string[]; neutral: string[] } {
    this.expect(TokenType.LEFT_BRACKET);
    const csharp: string[] = [];
    const neutral: string[] = [];
    const first = this.parseDeukBracketFirstName();
    const firstLower = first.toLowerCase();

    if ((firstLower === 'csharp' || firstLower === 'c#') && this.check(TokenType.COLON)) {
      this.advance();
      const inner = this.consumeDeukBracketInnerUntilRightBracket().trim();
      if (inner) csharp.push(`[${inner}]`);
      this.expect(TokenType.RIGHT_BRACKET);
      return { csharp, neutral };
    }

    if (DeukPackASTBuilder.NON_OFFICIAL_BRACKET_SKIP_FIRST.has(firstLower)) {
      if (this.check(TokenType.COLON)) {
        this.advance();
        this.consumeDeukBracketInnerUntilRightBracket();
      }
      if (this.check(TokenType.LEFT_PAREN)) {
        this.advance();
        while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
          this.advance();
        }
        if (this.check(TokenType.RIGHT_PAREN)) this.advance();
      }
      this.expect(TokenType.RIGHT_BRACKET);
      return { csharp: [], neutral: [] };
    }

    let piece = first;
    if (this.check(TokenType.COLON)) {
      this.advance();
      piece += ':';
      piece += this.consumeDeukBracketInnerUntilRightBracket();
    }
    if (this.check(TokenType.LEFT_PAREN)) {
      this.advance();
      piece += '(';
      while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
        const t = this.advance();
        piece += this.deukBracketTokenFragment(t);
      }
      if (this.check(TokenType.RIGHT_PAREN)) {
        this.advance();
        piece += ')';
      }
    }
    this.expect(TokenType.RIGHT_BRACKET);

    const base = this.neutralDeukBracketBaseName(piece);
    if (DeukPackASTBuilder.NEUTRAL_DEUK_BRACKET_NAMES.has(base)) {
      neutral.push(piece);
    } else {
      csharp.push(`[${piece}]`);
    }
    return { csharp, neutral };
  }

  /**
   * Parse type declaration
   */
  private parseType(): DeukPackType {
    const token = this.peek();

    switch (token.type) {
      case TokenType.BOOL:
        this.advance();
        return 'bool';
      case TokenType.BYTE: {
        const v = token.value;
        this.advance();
        return v === 'byte' ? 'byte' : 'int8';
      }
      case TokenType.I16:
        this.advance();
        return 'int16';
      case TokenType.I32:
        this.advance();
        return 'int32';
      case TokenType.I64:
        this.advance();
        return 'int64';
      case TokenType.DOUBLE: {
        const v = token.value;
        this.advance();
        return v === 'float' ? 'float' : 'double';
      }
      case TokenType.STRING:
        this.advance();
        return 'string';
      case TokenType.BINARY:
        this.advance();
        return 'binary';
      case TokenType.IDENTIFIER:
        return this.parseIdentifierType();
      case TokenType.LIST:
        return this.parseListType();
      case TokenType.ARRAY:
        return this.parseArrayType();
      case TokenType.SET:
        return this.parseSetType();
      case TokenType.MAP:
        return this.parseMapType();
      case TokenType.TABLELINK:
        return this.parseTableLinkType();
      default:
        throw new Error(`Unexpected token: ${token.type}`);
    }
  }

  /** 레거시 식별자 타입(i32 등) → 득팩 이름 정규화 (Protobuf와 동일하게 AST에는 득팩 타입만 저장) */
  private static readonly THRIFT_TYPE_TO_DEUKPACK: Record<string, DeukPackType> = {
    i8: 'int8',
    i16: 'int16',
    i32: 'int32',
    i64: 'int64'
  };

  /** 득팩 테이블 프리미티브(DEUKPACK_IDL_DESIGN §5.1): name/note는 string 별칭. id/tid는 int64와 동일해 타입 구분 불필요. */
  private static readonly META_PRIMITIVES: Record<string, DeukPackType> = {
    mname: 'string',
    mnote: 'string'
  };

  /**
   * Parse identifier type (handles namespaced types like mo_define.projectile_type_e)
   */
  private parseIdentifierType(): DeukPackType {
    let typeName = this.expect(TokenType.IDENTIFIER).value;

    // Handle namespaced types: . or :: (DeukPack uses :: in .deuk; store as . in AST)
    while (this.check(TokenType.DOT) || this.check(TokenType.COLON)) {
      if (this.check(TokenType.DOT)) this.advance();
      else { this.advance(); this.expect(TokenType.COLON); }
      const nextPart = this.expect(TokenType.IDENTIFIER).value;
      typeName += '.' + nextPart;
    }

    // 득팩 테이블 프리미티브(id, tid, mname, mnote) — 단일 식별자일 때만
    const primitive = DeukPackASTBuilder.META_PRIMITIVES[typeName];
    if (primitive !== undefined) return primitive;
    // 레거시 식별자(i32 등) → 득팩 타입으로 정규화 (단일 식별자일 때만)
    const normalized = DeukPackASTBuilder.THRIFT_TYPE_TO_DEUKPACK[typeName];
    if (normalized !== undefined) return normalized;
    return typeName as DeukPackType;
  }

  /**
   * Parse list type
   */
  private parseListType(): DeukPackType {
    this.advance(); // consume 'list'
    this.expect(TokenType.LEFT_BRACKET);
    const elementType = this.parseType();
    this.expect(TokenType.RIGHT_BRACKET);

    return {
      type: 'list',
      elementType
    } as unknown as DeukPackType;
  }

  /** Parse array<elem, size> — 고정 길이; 와이어는 list와 동일. */
  private parseArrayType(): DeukPackType {
    this.advance(); // consume 'array'
    this.expect(TokenType.LEFT_BRACKET);
    const elementType = this.parseType();
    this.expect(TokenType.COMMA);
    const numTok = this.expect(TokenType.NUMBER);
    const size = parseInt(numTok.value, 10);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`Invalid array size: ${numTok.value}`);
    }
    this.expect(TokenType.RIGHT_BRACKET);

    return {
      type: 'array',
      elementType,
      size
    } as unknown as DeukPackType;
  }

  /**
   * Parse set type
   */
  private parseSetType(): DeukPackType {
    this.advance(); // consume 'set'
    this.expect(TokenType.LEFT_BRACKET);
    const elementType = this.parseType();
    this.expect(TokenType.RIGHT_BRACKET);

    return {
      type: 'set',
      elementType
    } as unknown as DeukPackType;
  }

  /**
   * Parse tablelink<TableCategory, KeyField> — 득팩 테이블 행 참조.
   */
  private parseTableLinkType(): DeukPackType {
    this.advance(); // consume 'tablelink'
    this.expect(TokenType.LEFT_BRACKET);
    const tableCategory = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.COMMA);
    const keyField = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.RIGHT_BRACKET);
    return { type: 'tablelink', tableCategory, keyField } as unknown as DeukPackType;
  }

  /**
   * Parse map type
   */
  private parseMapType(): DeukPackType {
    this.advance(); // consume 'map'
    this.expect(TokenType.LEFT_BRACKET);
    const keyType = this.parseType();
    this.expect(TokenType.COMMA);
    const valueType = this.parseType();
    this.expect(TokenType.RIGHT_BRACKET);

    return {
      type: 'map',
      keyType,
      valueType
    } as unknown as DeukPackType;
  }

  /**
   * Parse default value
   */
  private parseDefaultValue(): any {
    const token = this.peek();

    switch (token.type) {
      case TokenType.NUMBER:
        this.advance();
        return parseDeukNumericLiteral(token.value);
      case TokenType.STRING_LITERAL:
        this.advance();
        return token.value;
      case TokenType.BOOLEAN:
        this.advance();
        return token.value === 'true';
      case TokenType.IDENTIFIER:
        return this.parseIdentifierDefaultValue();
      case TokenType.LEFT_BRACE:
        return this.parseObjectDefaultValue();
      case TokenType.LEFT_BRACKET:
        return this.parseArrayDefaultValue();
      default:
        throw new Error(`Unexpected default value: ${token.type}`);
    }
  }

  /**
   * Parse identifier default value (handles namespaced values; . or :: in .deuk, stored as . in AST)
   */
  private parseIdentifierDefaultValue(): string {
    let value = this.expect(TokenType.IDENTIFIER).value;

    while (this.check(TokenType.DOT) || this.check(TokenType.COLON)) {
      if (this.check(TokenType.DOT)) this.advance();
      else { this.advance(); this.expect(TokenType.COLON); }
      const nextPart = this.expect(TokenType.IDENTIFIER).value;
      value += '.' + nextPart;
    }

    return value;
  }

  /**
   * Parse array default value (handles values like [{"weight":30}, {"weight":30}] or [])
   */
  private parseArrayDefaultValue(): any[] {
    this.expect(TokenType.LEFT_BRACKET);

    // Handle empty array []
    if (this.check(TokenType.RIGHT_BRACKET)) {
      this.advance();
      return [];
    }

    // Parse array content
    const arr: any[] = [];

    while (!this.check(TokenType.RIGHT_BRACKET) && !this.isAtEnd()) {
      // Skip whitespace and comments
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance();
        continue;
      }

      // Parse array element
      let element: any = undefined;
      if (this.check(TokenType.STRING_LITERAL)) {
        element = this.expect(TokenType.STRING_LITERAL).value;
      } else if (this.check(TokenType.NUMBER)) {
        element = parseDeukNumericLiteral(this.expect(TokenType.NUMBER).value);
      } else if (this.check(TokenType.BOOLEAN)) {
        element = this.expect(TokenType.BOOLEAN).value === 'true';
      } else if (this.check(TokenType.LEFT_BRACE)) {
        element = this.parseObjectDefaultValue();
      } else if (this.check(TokenType.LEFT_BRACKET)) {
        element = this.parseArrayDefaultValue();
      }

      if (element !== undefined) {
        arr.push(element);
      }

      // Skip comma if present
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RIGHT_BRACKET);
    return arr;
  }

  /**
   * Parse object default value (handles values like { "version": 20250802 } or {})
   */
  private parseObjectDefaultValue(): any {
    this.expect(TokenType.LEFT_BRACE);

    // Handle empty object {}
    if (this.check(TokenType.RIGHT_BRACE)) {
      this.advance();
      return {};
    }

    // Parse object content
    const obj: any = {};

    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      // Skip whitespace and comments
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance();
        continue;
      }

      // Parse key-value pairs
      if (this.check(TokenType.STRING_LITERAL)) {
        const key = this.expect(TokenType.STRING_LITERAL).value;

        // Skip colon
        if (this.check(TokenType.COLON)) {
          this.advance();
        }

        // Parse value (string, number, boolean, object, or identifier e.g. id_e.req_login)
        let value: any = undefined;
        if (this.check(TokenType.STRING_LITERAL)) {
          value = this.expect(TokenType.STRING_LITERAL).value;
        } else if (this.check(TokenType.NUMBER)) {
          value = parseDeukNumericLiteral(this.expect(TokenType.NUMBER).value);
        } else if (this.check(TokenType.BOOLEAN)) {
          value = this.expect(TokenType.BOOLEAN).value === 'true';
        } else if (this.check(TokenType.LEFT_BRACE)) {
          value = this.parseObjectDefaultValue();
        } else if (this.check(TokenType.IDENTIFIER)) {
          value = this.parseIdentifierDefaultValue();
        }

        obj[key] = value;

        // Skip comma if present
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      } else {
        this.advance(); // Skip unknown tokens
      }
    }

    if (this.check(TokenType.RIGHT_BRACE)) {
      this.advance();
    }

    return obj;
  }

  /**
   * Parse enum declaration
   */
  private parseEnum(docComment?: string): DeukPackEnum {
    this.advance(); // consume 'enum'

    const name = this.expect(TokenType.IDENTIFIER).value;
    const annotations = this.tryParseAnnotations();
    this.expect(TokenType.LEFT_BRACE);

    const values: { [key: string]: number } = {};
    const valueComments: { [key: string]: string } = {};
    let currentValue = 0;

    while (!this.check(TokenType.RIGHT_BRACE)) {
      const memberComment = this.collectLeadingComments();
      if (this.check(TokenType.RIGHT_BRACE)) break;

      const enumName = this.expect(TokenType.IDENTIFIER).value;

      if (this.check(TokenType.EQUALS)) {
        this.advance();
        currentValue = parseDeukNumericLiteral(this.expect(TokenType.NUMBER).value);
      }

      values[enumName] = currentValue;
      if (memberComment) valueComments[enumName] = memberComment;
      currentValue++;

      if (this.check(TokenType.COMMA)) this.advance();
      while (this.check(TokenType.WHITESPACE) || this.check(TokenType.NEWLINE)) {
        this.advance();
      }
    }

    this.expect(TokenType.RIGHT_BRACE);

    const result: DeukPackEnum = { name, values };
    if (docComment) {
      const parsed = this.parseDocCommentAndCSharpAttributes(docComment);
      if (parsed.docComment) result.docComment = parsed.docComment;
      if (parsed.csharpAttributes?.length) result.csharpAttributes = parsed.csharpAttributes;
    }
    if (Object.keys(valueComments).length) result.valueComments = valueComments;
    if (annotations) result.annotations = annotations;
    return result;
  }

  /**
   * Parse service declaration
   */
  private parseService(docComment?: string): DeukPackService {
    this.advance(); // consume 'service'

    const name = this.expect(TokenType.IDENTIFIER).value;
    const annotations = this.tryParseAnnotations();
    this.expect(TokenType.LEFT_BRACE);

    const methods: DeukPackMethod[] = [];

    while (!this.check(TokenType.RIGHT_BRACE)) {
      if (this.check(TokenType.LINE_COMMENT) || this.check(TokenType.BLOCK_COMMENT)) {
        this.advance(); // skip comments
        continue;
      }
      methods.push(this.parseServiceMethod());
      if (this.check(TokenType.COMMA) || this.check(TokenType.SEMICOLON)) {
        this.advance();
      }
    }

    this.expect(TokenType.RIGHT_BRACE);

    const result: DeukPackService = { name, methods };
    if (docComment) result.docComment = docComment;
    if (annotations) result.annotations = annotations;
    return result;
  }

  /**
   * Parse a single service method: returnType methodName( [ params ] )
   */
  private parseServiceMethod(): DeukPackMethod {
    const returnType = this.parseType();
    const methodName = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LEFT_PAREN);
    const parameters: DeukPackField[] = [];
    while (this.check(TokenType.NUMBER) && !this.isAtEnd()) {
      const idToken = this.advance();
      const fieldId = typeof idToken.value === 'number' ? idToken.value : parseInt(String(idToken.value), 10);
      if (this.check(TokenType.COLON)) this.advance();
      const paramType = this.parseType();
      const paramName = this.expect(TokenType.IDENTIFIER).value;
      parameters.push({ id: fieldId, name: paramName, type: paramType, required: true });
      if (this.check(TokenType.COMMA)) this.advance();
    }
    if (this.check(TokenType.RIGHT_PAREN)) this.advance();
    return { name: methodName, returnType, parameters, oneway: false };
  }

  /**
   * Parse include statement
   */
  private parseInclude(): string {
    this.advance(); // consume 'include'
    const fileName = this.expect(TokenType.STRING_LITERAL).value;
    // Include statements don't require semicolons
    return fileName;
  }

  /**
   * Parse typedef declaration
   */
  private parseTypedef(docComment?: string): any {
    this.advance(); // consume 'typedef'

    const type = this.parseType();
    const name = this.expect(TokenType.IDENTIFIER).value;
    const annotations = this.tryParseAnnotations();

    const result: any = { name, type };
    if (docComment) result.docComment = docComment;
    if (annotations) result.annotations = annotations;
    return result;
  }

  /**
   * Parse const declaration
   */
  private parseConst(docComment?: string): any {
    this.advance(); // consume 'const'

    const type = this.parseType();
    const name = this.expect(TokenType.IDENTIFIER).value;
    const annotations = this.tryParseAnnotations();
    this.expect(TokenType.EQUALS);
    const value = this.parseDefaultValue();

    const result: any = { name, type, value };
    if (docComment) result.docComment = docComment;
    if (annotations) result.annotations = annotations;
    return result;
  }


  /**
   * Check if current token matches expected type
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Expect token of specific type and advance
   */
  private expect(type: TokenType): DeukPackToken {
    if (this.check(type)) {
      return this.advance();
    }
    const current = this.peek();
    throw new Error(`Expected ${type}, got ${current.type} (value: "${current.value}") at line ${current.line}, column ${current.column}`);
  }

  /**
   * Advance and return current token
   */
  private advance(): DeukPackToken {
    if (!this.isAtEnd()) {
      this.position++;
    }
    return this.previous();
  }

  /**
   * Get current token without advancing
   */
  private peek(): DeukPackToken {
    return this.tokens[this.position] || { type: TokenType.EOF, value: '', position: 0, line: 0, column: 0 };
  }

  /**
   * Get previous token
   */
  private previous(): DeukPackToken {
    return this.tokens[this.position - 1] || { type: TokenType.EOF, value: '', position: 0, line: 0, column: 0 };
  }

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
}
