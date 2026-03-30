/**
 * Thrift 호환(tbinary / tcompact / tjson) 및 Protobuf(protv2 / protv3) struct 직렬화:
 * IDL에서 얻은 DeukPackStruct + 값 객체.
 * DpTBinaryProtocol / DpTCompactProtocol / DpTJsonProtocol 과 동일한 필드 순서·타입 규칙을 따른다.
 */

import { DpTJsonProtocol } from '../protocols/JsonProtocol';
import {
  DpTBinaryProtocol,
  DpTCompactProtocol,
  DpWireType,
  type DpProtocol
} from '../protocols/WireProtocol';
import type { DeukPackField, DeukPackStruct, DeukPackType, SerializationOptions, WireProtocol } from '../types/DeukPackTypes';
import { serializeProtoStruct, deserializeProtoStruct } from './protoInteropWireCodec';

const INITIAL_BUFFER_BYTES = 512 * 1024;

const PRIMITIVE_STRING_TYPES = new Set([
  'bool',
  'byte',
  'int8',
  'int16',
  'int32',
  'int64',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'float',
  'double',
  'string',
  'binary',
  'datetime',
  'timestamp',
  'date',
  'time',
  'decimal',
  'numeric',
  // Thrift-style aliases (some AST paths)
  'i8',
  'i16',
  'i32',
  'i64'
]);

/** Map Thrift-style primitive names to DeukPack canonical strings. */
function resolvePrimitiveTypeString(t: string): string {
  switch (t) {
    case 'i8':
      return 'int8';
    case 'i16':
      return 'int16';
    case 'i32':
      return 'int32';
    case 'i64':
      return 'int64';
    default:
      return t;
  }
}

export type CanonicalInteropWireProtocol = 'tbinary' | 'tcompact' | 'tjson' | 'protv2' | 'protv3';

export function canonicalInteropWireProtocol(protocol: WireProtocol): CanonicalInteropWireProtocol {
  switch (protocol) {
    case 'tbinary':
      return 'tbinary';
    case 'tcompact':
      return 'tcompact';
    case 'tjson':
      return 'tjson';
    case 'protv2':
      return 'protv2';
    case 'protv3':
      return 'protv3';
    default:
      throw new Error(`[DeukPack] Not an interop wire protocol: "${protocol}"`);
  }
}

type Ctx = {
  root: DeukPackStruct;
  defs: Record<string, DeukPackStruct>;
};

function lookupStruct(structName: string, ctx: Ctx): DeukPackStruct {
  if (structName === ctx.root.name) return ctx.root;
  const s = ctx.defs[structName];
  if (!s) {
    throw new Error(
      `[DeukPack] interopStructDefs missing struct "${structName}" (nested types must be registered by name).`
    );
  }
  return s;
}

function dpWireTypeForFieldHeader(field: DeukPackField): DpWireType {
  if (field.enumValues) return DpWireType.Int32;
  const t = field.type;
  if (typeof t === 'string') {
    const ts = resolvePrimitiveTypeString(t);
    if (PRIMITIVE_STRING_TYPES.has(t)) return wireTypeForPrimitiveString(ts);
    return DpWireType.Struct;
  }
  if (typeof t === 'object' && t !== null && 'type' in t) {
    const o = t as { type: string };
    if (o.type === 'list' || o.type === 'array') return DpWireType.List;
    if (o.type === 'set') return DpWireType.Set;
    if (o.type === 'map') return DpWireType.Map;
    if (o.type === 'tablelink') return DpWireType.Int64;
  }
  return DpWireType.Struct;
}

function wireTypeForPrimitiveString(resolved: string): DpWireType {
  switch (resolved) {
    case 'bool':
      return DpWireType.Bool;
    case 'byte':
    case 'int8':
      return DpWireType.Byte;
    case 'int16':
    case 'uint16':
      return DpWireType.Int16;
    case 'int32':
    case 'uint32':
    case 'date':
    case 'time':
      return DpWireType.Int32;
    case 'int64':
    case 'uint64':
    case 'datetime':
    case 'timestamp':
      return DpWireType.Int64;
    case 'float':
    case 'double':
      return DpWireType.Double;
    case 'string':
    case 'binary':
    case 'decimal':
    case 'numeric':
      return DpWireType.String;
    default:
      return DpWireType.Struct;
  }
}

function elementWireTypeForContainerElement(elementType: DeukPackType, _ctx: Ctx): DpWireType {
  const syn: DeukPackField = {
    id: 0,
    name: '_',
    type: elementType,
    required: true
  };
  return dpWireTypeForFieldHeader(syn);
}

function structNameForField(field: DeukPackField): string {
  const t = field.type;
  if (typeof t === 'string') {
    const ts = resolvePrimitiveTypeString(t);
    if (field.structType) return field.structType;
    if (!PRIMITIVE_STRING_TYPES.has(t) && !field.enumValues) return ts;
  }
  if (typeof t === 'object' && t !== null && 'structType' in t && typeof (t as { structType?: string }).structType === 'string') {
    return (t as { structType: string }).structType;
  }
  throw new Error(`[DeukPack] interop: cannot resolve struct name for field "${field.name}"`);
}

function skipValue(p: DpProtocol, type: DpWireType): void {
  switch (type) {
    case DpWireType.Stop:
      return;
    case DpWireType.Bool:
    case DpWireType.Byte:
      p.readByte();
      return;
    case DpWireType.Double:
      p.readDouble();
      return;
    case DpWireType.Int16:
      p.readI16();
      return;
    case DpWireType.Int32:
      p.readI32();
      return;
    case DpWireType.Int64:
      p.readI64();
      return;
    case DpWireType.String:
      p.readString();
      return;
    case DpWireType.Struct: {
      while (true) {
        const f = p.readFieldBegin();
        if (f.type === DpWireType.Stop) {
          p.readFieldEnd();
          break;
        }
        skipValue(p, f.type);
        p.readFieldEnd();
      }
      return;
    }
    case DpWireType.List:
    case DpWireType.Set: {
      const lb = type === DpWireType.List ? p.readListBegin() : p.readSetBegin();
      for (let i = 0; i < lb.count; i++) skipValue(p, lb.elementType);
      if (type === DpWireType.List) p.readListEnd();
      else p.readSetEnd();
      return;
    }
    case DpWireType.Map: {
      const mb = p.readMapBegin();
      for (let i = 0; i < mb.count; i++) {
        skipValue(p, mb.keyType);
        skipValue(p, mb.valueType);
      }
      p.readMapEnd();
      return;
    }
    default:
      p.readByte();
  }
}

function writeStructBody(p: DpProtocol, obj: Record<string, unknown>, struct: DeukPackStruct, ctx: Ctx): void {
  p.writeStructBegin({ name: struct.name });
  for (const field of struct.fields) {
    const raw = obj[field.name];
    if (raw === undefined || raw === null) {
      if (field.required) {
        throw new Error(`[DeukPack] interop: missing required field "${field.name}" on struct "${struct.name}"`);
      }
      continue;
    }
    const headerType = dpWireTypeForFieldHeader(field);
    p.writeFieldBegin({ name: field.name, type: headerType, id: field.id });
    writeValue(p, raw, field, ctx);
    p.writeFieldEnd();
  }
  p.writeFieldStop();
  p.writeStructEnd();
}

function writeValue(p: DpProtocol, value: unknown, field: DeukPackField, ctx: Ctx): void {
  const t = field.type;
  if (field.enumValues) {
    let n: number;
    if (typeof value === 'number') n = value;
    else if (typeof value === 'string') {
      const v = field.enumValues[value];
      if (v === undefined) throw new Error(`[DeukPack] interop: unknown enum "${value}" for field "${field.name}"`);
      n = Number(v);
    } else throw new Error(`[DeukPack] interop: invalid enum value for field "${field.name}"`);
    p.writeI32(n);
    return;
  }
  if (typeof t === 'string') {
    const ts = resolvePrimitiveTypeString(t);
    if (PRIMITIVE_STRING_TYPES.has(t)) {
      writePrimitive(p, ts, value);
      return;
    }
    const child = lookupStruct(structNameForField(field), ctx);
    writeStructBody(p, value as Record<string, unknown>, child, ctx);
    return;
  }
  if (typeof t === 'object' && t !== null && 'type' in t) {
    const o = t as { type: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
    if (o.type === 'list' || o.type === 'array') {
      const arr = value as unknown[];
      if (!Array.isArray(arr)) throw new Error(`[DeukPack] interop: field "${field.name}" expects array`);
      const et = o.elementType!;
      const elemWt = elementWireTypeForContainerElement(et, ctx);
      p.writeListBegin({ elementType: elemWt, count: arr.length });
      for (const item of arr) {
        writeElementValue(p, et, item, ctx);
      }
      p.writeListEnd();
      return;
    }
    if (o.type === 'set') {
      const arr = value as unknown[];
      if (!Array.isArray(arr)) throw new Error(`[DeukPack] interop: field "${field.name}" expects array (set)`);
      const et = o.elementType!;
      const elemWt = elementWireTypeForContainerElement(et, ctx);
      p.writeSetBegin({ elementType: elemWt, count: arr.length });
      for (const item of arr) {
        writeElementValue(p, et, item, ctx);
      }
      p.writeSetEnd();
      return;
    }
    if (o.type === 'map') {
      const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as Record<string, unknown>);
      const kt = o.keyType!;
      const vt = o.valueType!;
      const keyWt = elementWireTypeForContainerElement(kt, ctx);
      const valWt = elementWireTypeForContainerElement(vt, ctx);
      p.writeMapBegin({ keyType: keyWt, valueType: valWt, count: entries.length });
      for (const [k, v] of entries) {
        writeElementValue(p, kt, k, ctx);
        writeElementValue(p, vt, v, ctx);
      }
      p.writeMapEnd();
      return;
    }
    if (o.type === 'tablelink') {
      p.writeI64(BigInt(Number(value)));
      return;
    }
  }
  throw new Error(`[DeukPack] interop: unsupported field type for "${field.name}"`);
}

function writeElementValue(p: DpProtocol, elementType: DeukPackType, value: unknown, ctx: Ctx): void {
  const syn: DeukPackField = { id: 0, name: '_el', type: elementType, required: true };
  writeValue(p, value, syn, ctx);
}

function writePrimitive(p: DpProtocol, prim: string, value: unknown): void {
  switch (prim) {
    case 'bool':
      p.writeBool(Boolean(value));
      return;
    case 'byte':
    case 'int8':
      p.writeByte(Number(value));
      return;
    case 'int16':
    case 'uint16':
      p.writeI16(Number(value));
      return;
    case 'int32':
    case 'uint32':
    case 'date':
    case 'time':
      p.writeI32(Number(value));
      return;
    case 'int64':
    case 'uint64':
    case 'datetime':
    case 'timestamp':
      p.writeI64(typeof value === 'bigint' ? value : BigInt(Number(value)));
      return;
    case 'float':
    case 'double':
      p.writeDouble(Number(value));
      return;
    case 'string':
      p.writeString(value != null ? String(value) : '');
      return;
    case 'binary': {
      const u8 = toUint8Array(value);
      p.writeBinary(u8);
      return;
    }
    case 'decimal':
    case 'numeric':
      p.writeString(value != null ? String(value) : '');
      return;
    default:
      throw new Error(`[DeukPack] interop: unsupported primitive "${prim}"`);
  }
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error('[DeukPack] interop: binary field expects Uint8Array (or Buffer)');
}

function readStructBody(p: DpProtocol, struct: DeukPackStruct, ctx: Ctx): Record<string, unknown> {
  p.readStructBegin();
  const out: Record<string, unknown> = {};
  while (true) {
    const fb = p.readFieldBegin();
    if (fb.type === DpWireType.Stop) {
      p.readFieldEnd();
      break;
    }
    const field = struct.fields.find((f) => f.id === fb.id);
    if (!field) {
      skipValue(p, fb.type);
      p.readFieldEnd();
      continue;
    }
    out[field.name] = readValue(p, field, ctx);
    p.readFieldEnd();
  }
  p.readStructEnd();
  return out;
}

function readValue(p: DpProtocol, field: DeukPackField, ctx: Ctx): unknown {
  const t = field.type;
  if (field.enumValues) {
    return p.readI32();
  }
  if (typeof t === 'string') {
    const ts = resolvePrimitiveTypeString(t);
    if (PRIMITIVE_STRING_TYPES.has(t)) {
      return readPrimitive(p, ts);
    }
    const child = lookupStruct(structNameForField(field), ctx);
    return readStructBody(p, child, ctx);
  }
  if (typeof t === 'object' && t !== null && 'type' in t) {
    const o = t as { type: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
    if (o.type === 'list' || o.type === 'array') {
      const lb = p.readListBegin();
      const et = o.elementType!;
      const arr: unknown[] = [];
      for (let i = 0; i < lb.count; i++) arr.push(readElementValue(p, et, ctx));
      p.readListEnd();
      return arr;
    }
    if (o.type === 'set') {
      const sb = p.readSetBegin();
      const et = o.elementType!;
      const arr: unknown[] = [];
      for (let i = 0; i < sb.count; i++) arr.push(readElementValue(p, et, ctx));
      p.readSetEnd();
      return arr;
    }
    if (o.type === 'map') {
      const mb = p.readMapBegin();
      const kt = o.keyType!;
      const vt = o.valueType!;
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < mb.count; i++) {
        const k = readElementValue(p, kt, ctx);
        const v = readElementValue(p, vt, ctx);
        map.set(k, v);
      }
      p.readMapEnd();
      return map;
    }
    if (o.type === 'tablelink') {
      return p.readI64();
    }
  }
  throw new Error(`[DeukPack] interop: cannot read field "${field.name}"`);
}

function readElementValue(p: DpProtocol, elementType: DeukPackType, ctx: Ctx): unknown {
  const syn: DeukPackField = { id: 0, name: '_el', type: elementType, required: true };
  return readValue(p, syn, ctx);
}

function readPrimitive(p: DpProtocol, prim: string): unknown {
  switch (prim) {
    case 'bool':
      return p.readBool();
    case 'byte':
    case 'int8':
      return p.readByte();
    case 'int16':
    case 'uint16':
      return p.readI16();
    case 'int32':
    case 'uint32':
    case 'date':
    case 'time':
      return p.readI32();
    case 'int64':
    case 'uint64':
    case 'datetime':
    case 'timestamp':
      return p.readI64();
    case 'float':
    case 'double':
      return p.readDouble();
    case 'string':
      return p.readString();
    case 'binary':
      return p.readBinary();
    case 'decimal':
    case 'numeric':
      return p.readString();
    default:
      throw new Error(`[DeukPack] interop: unsupported primitive "${prim}"`);
  }
}

function createProtocolWriter(kind: CanonicalInteropWireProtocol, littleEndian: boolean): DpProtocol {
  const buf = new ArrayBuffer(INITIAL_BUFFER_BYTES);
  if (kind === 'tbinary') return new DpTBinaryProtocol(buf, littleEndian);
  if (kind === 'tcompact') return new DpTCompactProtocol(buf, littleEndian);
  return new DpTJsonProtocol({}, false);
}

function createProtocolReader(kind: CanonicalInteropWireProtocol, data: Uint8Array, littleEndian: boolean): DpProtocol {
  if (kind === 'tbinary') {
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new DpTBinaryProtocol(copy, littleEndian);
  }
  if (kind === 'tcompact') {
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new DpTCompactProtocol(copy, littleEndian);
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  return new DpTJsonProtocol(text, true);
}

export function assertInteropStructOptions(options: SerializationOptions): asserts options is SerializationOptions & {
  interopRootStruct: DeukPackStruct;
} {
  const root = (options as SerializationOptions & { interopRootStruct?: DeukPackStruct }).interopRootStruct;
  if (!root) {
    throw new Error(
      '[DeukPack] Interop wire (tbinary / tcompact / tjson) requires SerializationOptions.interopRootStruct ' +
        'and interopStructDefs for nested struct names. Obtain structs from parse/AST or schema export.'
    );
  }
}

export function serializeInteropStruct(
  obj: Record<string, unknown>,
  options: SerializationOptions & { interopRootStruct: DeukPackStruct; interopStructDefs?: Record<string, DeukPackStruct> }
): Uint8Array {
  assertInteropStructOptions(options);
  const kind = canonicalInteropWireProtocol(options.protocol);
  if (kind === 'protv2' || kind === 'protv3') {
    return serializeProtoStruct(obj, options);
  }
  const le = options.endianness === 'LE';
  const ctx: Ctx = {
    root: options.interopRootStruct,
    defs: options.interopStructDefs ?? {}
  };
  const p = createProtocolWriter(kind, le);
  writeStructBody(p, obj, options.interopRootStruct, ctx);
  if (kind === 'tjson') {
    const out = (p as DpTJsonProtocol).getOutput();
    return new TextEncoder().encode(out);
  }
  const proto = p as DpTBinaryProtocol | DpTCompactProtocol;
  return new Uint8Array(proto.getBuffer());
}

export function deserializeInteropStruct(
  data: Uint8Array,
  options: SerializationOptions & { interopRootStruct: DeukPackStruct; interopStructDefs?: Record<string, DeukPackStruct> }
): Record<string, unknown> {
  assertInteropStructOptions(options);
  const kind = canonicalInteropWireProtocol(options.protocol);
  if (kind === 'protv2' || kind === 'protv3') {
    return deserializeProtoStruct(data, options);
  }
  const le = options.endianness === 'LE';
  const ctx: Ctx = {
    root: options.interopRootStruct,
    defs: options.interopStructDefs ?? {}
  };
  const p = createProtocolReader(kind, data, le);
  return readStructBody(p, options.interopRootStruct, ctx);
}
