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
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
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
  | DeukPackArrayType
  | DeukPackSetType
  | DeukPackMapType
  | DeukPackTableLinkType;

export interface DeukPackListType {
  type: 'list';
  elementType: DeukPackType;
}

/** 고정 길이 배열 — 와이어는 가변 list와 동일(Thrift list 등). */
export interface DeukPackArrayType {
  type: 'array';
  elementType: DeukPackType;
  size: number;
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

/**
 * 외부 스택과의 **바이트/의미 호환** (Apache Thrift Binary·Compact, Thrift JSON 래퍼, Google Protobuf).
 * Thrift 계열: **`tbinary` / `tcompact` / `tjson`**. Protobuf 계열: **`protv2` / `protv3`**.
 * JS `WireSerializer`는 `interopRootStruct`(및 중첩용 `interopStructDefs`)가 있을 때 동일 와이어로 직렬화한다.
 */
export type InteropWireProtocol = 'tbinary' | 'tcompact' | 'tjson' | 'protv2' | 'protv3';

/**
 * **득팩 전용** 와이어: 태그 바이너리(`pack`), 값만 UTF-8 JSON/YAML (`json` / `yaml`).
 */
export type DeukNativeWireProtocol = 'pack' | 'json' | 'yaml';

export type WireProtocol = InteropWireProtocol | DeukNativeWireProtocol;

/** `protocol` 문자열이 속한 계열. */
export type WireProtocolFamily = 'interop' | 'deuk';

export function wireProtocolFamily(protocol: WireProtocol): WireProtocolFamily {
  if (protocol === 'tbinary' || protocol === 'tcompact' || protocol === 'tjson' || protocol === 'protv2' || protocol === 'protv3') return 'interop';
  return 'deuk';
}

/** 득팩 전용 와이어 목록 — 엔진·CLI 기본은 여기서 `pack` 우선. */
export const DEUK_NATIVE_WIRE_PROTOCOLS: readonly DeukNativeWireProtocol[] = ['pack', 'json', 'yaml'];

/** Thrift·Protobuf 등 외부 호환 와이어 목록. */
export const INTEROP_WIRE_PROTOCOLS: readonly InteropWireProtocol[] = ['tbinary', 'tcompact', 'tjson', 'protv2', 'protv3'];

export function isDeukNativeWireProtocol(p: WireProtocol): p is DeukNativeWireProtocol {
  return (DEUK_NATIVE_WIRE_PROTOCOLS as readonly string[]).includes(p);
}

export function isInteropWireProtocol(p: WireProtocol): p is InteropWireProtocol {
  return (INTEROP_WIRE_PROTOCOLS as readonly string[]).includes(p);
}

/**
 * 구분된 프로토콜 옵션: **득팩 우선**을 타입으로 고정할 때 사용.
 * `wireKind: 'deuk'` → `pack` | `json` | `yaml` 만 허용.
 * `wireKind: 'interop'` → Thrift 호환만 허용(코드에서 호환임이 드러남).
 */
export type DeukNativeWireOption = { wireKind: 'deuk'; protocol: DeukNativeWireProtocol };
export type InteropWireOption = { wireKind: 'interop'; protocol: InteropWireProtocol };
export type WireProtocolOption = DeukNativeWireOption | InteropWireOption;

export function wireProtocolOptionToFields(
  opt: WireProtocolOption
): Pick<SerializationOptions, 'protocol' | 'wireFamily'> {
  return opt.wireKind === 'deuk'
    ? { protocol: opt.protocol, wireFamily: 'deuk' }
    : { protocol: opt.protocol, wireFamily: 'interop' };
}

/** 득팩 전용 + 계열 명시(권장 조합). */
export function deukWire(protocol: DeukNativeWireProtocol): Pick<SerializationOptions, 'protocol' | 'wireFamily'> {
  return { protocol, wireFamily: 'deuk' };
}

/** 호환 와이어 + 계열 명시(코드젠·메타 힌트). */
export function interopWire(protocol: InteropWireProtocol): Pick<SerializationOptions, 'protocol' | 'wireFamily'> {
  return { protocol, wireFamily: 'interop' };
}

/** 권장 기본: 득팩 `pack` + `wireFamily: 'deuk'`. */
export const DEFAULT_DEUK_WIRE: Pick<SerializationOptions, 'protocol' | 'wireFamily'> = {
  protocol: 'pack',
  wireFamily: 'deuk',
};

/**
 * `wireFamily` 가 있으면 `protocol` 과 반드시 일치해야 한다.
 * (호환 프로토콜인지 득팩 전용인지 호출부에서 명시적으로 구분 가능하게 함.)
 */
export function assertSerializationWireOptions(options: SerializationOptions): void {
  if (options.wireFamily === undefined) return;
  const inferred = wireProtocolFamily(options.protocol);
  if (options.wireFamily !== inferred) {
    throw new Error(
      `[DeukPack] wireFamily "${options.wireFamily}" does not match protocol "${options.protocol}" (expected "${inferred}"). ` +
        'Interop: tbinary | tcompact | tjson | protv2 | protv3. Deuk native: pack | json | yaml.'
    );
  }
}

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
  /** Neutral .deuk bracket tags (e.g. key, table:x); codegen maps these per declaration kind */
  deukBracketAttributes?: string[];
  annotations?: { [key: string]: string };
}

/** IDL 최상위 정의 키워드에 대응. 코드젠·검증·메타에서 구분용 (와이어/필드 규칙은 record와 동일할 수 있음). */
export type DeukPackStructDeclarationKind = 'record' | 'entity' | 'message' | 'table';

export interface DeukPackStruct {
  name: string;
  fields: DeukPackField[];
  /** Doc comment immediately above struct (recoverable to IDL) */
  docComment?: string;
  /** C# attributes parsed from doc comment lines like /// [Table("Users")] (DeukPack extension) */
  csharpAttributes?: string[];
  /** Neutral .deuk bracket tags before `{` (e.g. table:x, schema:dbo) */
  deukBracketAttributes?: string[];
  annotations?: { [key: string]: string };
  /** 테이블 키 필드명(단일 또는 복합). container/table struct의 (key = "level") 또는 (key = "cid,level"). 미선언 시 ["tuid"]. */
  keyFieldNames?: string[];
  sourceFile?: string;
  /** struct 상속: 부모 struct 이름. 파싱 후 resolveExtends에서 부모 필드를 자식에 병합한다. */
  extends?: string;
  /**
   * record | entity | message | table — 파서가 키워드로 설정.
   * 생략 시 레거시(.thrift 등) 또는 구버전 AST는 `record`로 간주할 수 있음.
   */
  declarationKind?: DeukPackStructDeclarationKind;
}

export interface DeukPackEnum {
  name: string;
  values: { [key: string]: number };
  /** Synthesized for forward refs (e.g. ns.foo_e before parse order); not from IDL */
  forwardRefPlaceholder?: boolean;
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
  type: 'struct';
  fields: DeukPackFullFieldSchema[] | { [id: string]: DeukPackFullFieldSchema };
  docComment?: string;
  annotations?: { [key: string]: string };
  sourceFile?: string;
  /** record | entity | message | table (IDL 키워드 구분) */
  declarationKind?: DeukPackStructDeclarationKind;
}

export interface DeukPackFullEnumSchema {
  name: string;
  type: 'enum';
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
  /** Canonical source path -> include strings from that file only (umbrella C++ headers). */
  fileIncludes?: { [sourceFile: string]: string[] };
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
  /** DB/ORM 등 영속 행 스키마용 record (문법은 record와 동일, AST에 declarationKind만 구분) */
  ENTITY = 'ENTITY',
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
  ARRAY = 'ARRAY',
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
  /**
   * 와이어 계열.
   * **권장:** 득팩 전용(`pack`/`json`/`yaml`)은 `deuk`를 명시. Thrift 호환(`tbinary`/`tcompact`/`tjson`)은 `interop`로 명시.
   * 생략 시 `wireProtocolFamily(protocol)`로 추론. npm `serialize`/`deserialize`의 **`WireExtras`**에 넣지 않아도 동일하게 추론된다.
   */
  wireFamily?: WireProtocolFamily;
  /**
   * 직렬화 포맷. **기본·권장(득팩 우선):** `pack`(태그 바이너리), 또는 `json`/`yaml`.
   * **호환:** `tbinary` / `tcompact` / `tjson`. JS에서는 `interopRootStruct`(+ `interopStructDefs`)와 함께 `WireSerializer`/`WireDeserializer`로 직렬화 가능.
   */
  protocol: WireProtocol;
  endianness: Endianness;
  optimizeForSize: boolean;
  includeDefaultValues: boolean;
  validateTypes: boolean;
  /**
   * Thrift 호환 직렬화 시 **필수**: 루트 struct 메타(IDL 파싱·스키마의 필드 id·타입).
   * 생략 시 `WireSerializer`/`WireDeserializer`는 호환 와이어에서 오류를 던진다.
   */
  interopRootStruct?: DeukPackStruct;
  /** 중첩 struct 이름 → 정의. 루트를 제외한 참조 타입은 여기에 등록한다. */
  interopStructDefs?: Record<string, DeukPackStruct>;
}

/** parseFileWithIncludes 옵션. includePaths가 있으면 해당 경로만 사용, 없으면 defineRoot 기준으로 기본 경로 구성. */
export interface ParseFileWithIncludesOptions {
  /** include 검색 경로 (지정 시 defineRoot 무시, -I 옵션 등). */
  includePaths?: string[];
  /** IDL 루트 디렉터리명 (예: 'idls', '_thrift'). includePaths 미지정 시 사용, 기본값 'idls'. */
  defineRoot?: string;
  /** 한 파일에 여러 `namespace` 선언 허용 여부. */
  allowMultiNamespace?: boolean;
}

/**
 * 코드 생성 옵션. **와이어 기본은 득팩 전용 `pack` 권장**(CLI `--protocol`).
 * Thrift 호환 힌트는 `tbinary` / `tcompact` / `tjson` — `INTEROP_WIRE_PROTOCOLS` / `interopWire()` 참고.
 */
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
  /**
   * 와이어 프로파일(서브셋): 필드 annotation `wireProfiles = "a,b"` 에 포함된 프로파일에만 노출되는 필드로
   * 파생 C# 타입(`{Struct}_{Profile}`) 및 동일 와이어 이름(DpRecord)의 부분 스키마를 추가 생성한다.
   * annotation 없는 필드는 모든 프로파일에 포함된다.
   */
  wireProfilesEmit?: string[];
  /** C# Nullable Reference Types (NRT) 지원: #nullable enable 및 참조 타입 ? 주석 생성. 기본값 false. */
  csharpNullable?: boolean;
  /** 단일 네임스페이스일 때 `namespace { }` 중괄호 블록 생략 여부. 인덴트는 유지. */
  braceLessNamespace?: boolean;
  /** 한 파일에 여러 `namespace` 선언 허용 여부. */
  allowMultiNamespace?: boolean;
  /** 명시적 생성기 목록 (e.g. ['csharp', 'mcp']). */
  generators?: string[];
  /** 다중 언어 생성 시 목표 언어 목록. */
  targetLanguages?: ('javascript' | 'cpp' | 'csharp')[];
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
