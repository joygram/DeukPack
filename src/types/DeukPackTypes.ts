/**
 * DeukPack Type Definitions
 * High-performance type system for IDL AST and codegen
 */

/** tablelink<TableCategory, KeyField> — 득팩 테이블 행 참조. 저장은 키 타입에 맞게(int64 등). */
export interface DeukPackTableLinkType {
  type: 'tablelink';
  tableCategory: string;
  keyField: string;
}

export type DeukPackType =
  | 'bool'
  | 'byte'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'float'
  | 'double'
  | 'string'
  | 'binary'
  | 'datetime'
  | 'timestamp'
  | 'date'
  | 'time'
  | 'decimal'
  | 'numeric'
  | 'list'
  | 'set'
  | 'map'
  | 'record'   // 득팩 표준 (struct와 동일 의미)
  | 'enum'
  | DeukPackListType
  | DeukPackSetType
  | DeukPackMapType
  | DeukPackTableLinkType;

export interface DeukPackListType {
  type: 'list';
  elementType: DeukPackType;
}

export interface DeukPackSetType {
  type: 'set';
  elementType: DeukPackType;
}

export interface DeukPackMapType {
  type: 'map';
  keyType: DeukPackType;
  valueType: DeukPackType;
}

export type Endianness = 'LE' | 'BE';

/** Wire format: 'binary'/'compact' = Thrift 호환; 'pack' = DeukPack 기본(성능·메모리 권장, 엔벨로프에 타입 저장); 'json' = DeukPack JSON. */
export type WireProtocol = 'binary' | 'compact' | 'pack' | 'json';

export interface DeukPackField {
  id: number;
  name: string;
  type: DeukPackType;
  required: boolean;
  defaultValue?: any;
  structType?: string;
  enumValues?: { [key: string]: number };
  /** Doc comment immediately above this field (recoverable to IDL) */
  docComment?: string;
  /** C# attributes parsed from doc comment lines like /// [Key], /// [Required] (DeukPack extension) */
  csharpAttributes?: string[];
  annotations?: { [key: string]: string };
}

export interface DeukPackStruct {
  name: string;
  fields: DeukPackField[];
  /** Doc comment immediately above struct (recoverable to IDL) */
  docComment?: string;
  /** C# attributes parsed from doc comment lines like /// [Table("Users")] (DeukPack extension) */
  csharpAttributes?: string[];
  annotations?: { [key: string]: string };
  /** 테이블 키 필드명(단일 또는 복합). container/table struct의 (key = "level") 또는 (key = "cid,level"). 미선언 시 ["tuid"]. */
  keyFieldNames?: string[];
  sourceFile?: string;
}

export interface DeukPackEnum {
  name: string;
  values: { [key: string]: number };
  /** Doc comment immediately above enum (recoverable to IDL) */
  docComment?: string;
  /** C# attributes parsed from doc comment lines like /// [Flags] (DeukPack extension) */
  csharpAttributes?: string[];
  /** Per-value doc comments: enum member name -> comment text */
  valueComments?: { [key: string]: string };
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

export interface DeukPackService {
  name: string;
  methods: DeukPackMethod[];
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

export interface DeukPackMethod {
  name: string;
  returnType: DeukPackType;
  parameters: DeukPackField[];
  oneway: boolean;
  docComment?: string;
  annotations?: { [key: string]: string };
}

export interface DeukPackNamespace {
  language: string;
  name: string;
  sourceFile?: string;
}

export interface DeukPackTypedef {
  name: string;
  type: DeukPackType;
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

export interface DeukPackConstant {
  name: string;
  type: DeukPackType;
  value: any;
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

/** Full schema format: all info needed to recover IDL (comments, annotations, defaults). Used by JSON/JS/C# and by Binary/JSON. */
export interface DeukPackFullFieldSchema {
  id: number;
  name: string;
  type: string;
  typeName: string;
  required: boolean;
  defaultValue: any;
  docComment?: string;
  annotations?: { [key: string]: string };
}

export interface DeukPackFullStructSchema {
  name: string;
  type: 'Struct';
  fields: DeukPackFullFieldSchema[] | { [id: string]: DeukPackFullFieldSchema };
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

export interface DeukPackFullEnumSchema {
  name: string;
  type: 'Enum';
  values: { [key: string]: number };
  valueComments?: { [key: string]: string };
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
}

export interface DeukPackFullSchema {
  structs: DeukPackFullStructSchema[];
  enums: DeukPackFullEnumSchema[];
  namespaces?: DeukPackNamespace[];
  typedefs?: DeukPackTypedef[];
  constants?: DeukPackConstant[];
  services?: DeukPackService[];
  generatedAt?: string;
}

export interface DeukPackAST {
  namespaces: DeukPackNamespace[];
  structs: DeukPackStruct[];
  enums: DeukPackEnum[];
  services: DeukPackService[];
  typedefs: DeukPackTypedef[];
  constants: DeukPackConstant[];
  includes: string[];
  filesProcessed?: number;
  annotations?: { [key: string]: string };
  fileNamespaceMap?: { [filePath: string]: string }; // 파일 경로 -> 네임스페이스 매핑
}

export interface DeukPackToken {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

export enum TokenType {
  // Keywords (득팩 표준: record, message 등)
  NAMESPACE = 'NAMESPACE',
  RECORD = 'RECORD',   // struct | record → 동일 토큰 (득팩 표준 명칭 record)
  MESSAGE = 'MESSAGE',
  ENUM = 'ENUM',
  SERVICE = 'SERVICE',
  TYPEDEF = 'TYPEDEF',
  CONST = 'CONST',
  INCLUDE = 'INCLUDE',
  EXCEPTION = 'EXCEPTION',
  UNION = 'UNION',

  // Types
  BOOL = 'BOOL',
  BYTE = 'BYTE',
  I16 = 'I16',
  I32 = 'I32',
  I64 = 'I64',
  DOUBLE = 'DOUBLE',
  STRING = 'STRING',
  BINARY = 'BINARY',
  LIST = 'LIST',
  SET = 'SET',
  MAP = 'MAP',

  // Meta (table row link / table definition)
  TABLELINK = 'TABLELINK',
  TABLE = 'TABLE',

  // Modifiers
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',

  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING_LITERAL = 'STRING_LITERAL',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',

  // Operators
  EQUALS = 'EQUALS',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  COMMA = 'COMMA',
  DOT = 'DOT',
  ASTERISK = 'ASTERISK',

  // Brackets
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',

  // Comments
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE'
}

export interface SerializationOptions {
  protocol: WireProtocol;
  endianness: Endianness;
  optimizeForSize: boolean;
  includeDefaultValues: boolean;
  validateTypes: boolean;
}

/** parseFileWithIncludes 옵션. includePaths가 있으면 해당 경로만 사용, 없으면 defineRoot 기준으로 기본 경로 구성. */
export interface ParseFileWithIncludesOptions {
  /** include 검색 경로 (지정 시 defineRoot 무시, -I 옵션 등). */
  includePaths?: string[];
  /** IDL 루트 디렉터리명 (예: 'idls', '_thrift'). includePaths 미지정 시 사용, 기본값 'idls'. */
  defineRoot?: string;
}

export interface GenerationOptions {
  targetLanguage: 'javascript' | 'cpp' | 'csharp';
  outputDir: string;
  generateTypes: boolean;
  generateSerializers: boolean;
  generateDeserializers: boolean;
  generateValidators: boolean;
  generateTests: boolean;
  namespacePrefix?: string;
  indentSize: number;
  useTabs: boolean;
  /** Entity Framework Core 지원: 메타 테이블 row 타입에 [Table]/[Key]/[Column], DeukPackDbContext.g.cs 생성 */
  efSupport?: boolean;
}

export interface PerformanceMetrics {
  parseTime: number;
  generateTime: number;
  serializeTime: number;
  deserializeTime: number;
  memoryUsage: number;
  fileCount: number;
  lineCount: number;
}

export interface DeukPackError {
  message: string;
  line: number;
  column: number;
  file?: string;
  severity: 'error' | 'warning' | 'info';
}

export class DeukPackException extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number,
    public file?: string
  ) {
    super(message);
    this.name = 'DeukPackException';
  }
}
