/**
 * Google Protobuf v2/v3 binary wire codec — schema-aware serialization/deserialization.
 * Uses DeukPackStruct schema + plain JS object ↔ protobuf binary bytes.
 * Compatible with standard protobuf decoders/encoders (field_number tags, varint encoding,
 * LEN-prefixed sub-messages, packed repeated numerics, map as repeated MapEntry).
 */

import type {
  DeukPackField,
  DeukPackStruct,
  DeukPackType,
  SerializationOptions
} from '../types/DeukPackTypes';

// ── Proto wire type constants ──

const PB_VARINT = 0;
const PB_I64 = 1;
const PB_LEN = 2;
// const PB_SGROUP = 3; // deprecated
// const PB_EGROUP = 4; // deprecated
const PB_I32 = 5;

// ── Buffer writer ──

class PbWriter {
  data: Uint8Array;
  offset: number;
  private view: DataView;

  constructor(initialCapacity = 512 * 1024) {
    this.data = new Uint8Array(initialCapacity);
    this.offset = 0;
    this.view = new DataView(this.data.buffer);
  }

  private ensureCapacity(extra: number): void {
    if (this.offset + extra <= this.data.byteLength) return;
    const needed = this.offset + extra;
    const newCap = Math.max(needed, this.data.byteLength * 2);
    const nd = new Uint8Array(newCap);
    nd.set(this.data.subarray(0, this.offset));
    this.data = nd;
    this.view = new DataView(this.data.buffer);
  }

  writeVarint(v: number): void {
    let u = v >>> 0;
    while (u > 0x7f) {
      this.ensureCapacity(1);
      this.data[this.offset++] = (u & 0x7f) | 0x80;
      u >>>= 7;
    }
    this.ensureCapacity(1);
    this.data[this.offset++] = u;
  }

  writeVarint64(v: bigint): void {
    let u = BigInt.asUintN(64, v);
    while (u > 0x7fn) {
      this.ensureCapacity(1);
      this.data[this.offset++] = Number((u & 0x7fn) | 0x80n);
      u >>= 7n;
    }
    this.ensureCapacity(1);
    this.data[this.offset++] = Number(u);
  }

  writeSignedVarint(v: number): void {
    this.writeVarint64(BigInt(v));
  }

  writeFixed32(v: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, v, true);
    this.offset += 4;
  }

  writeFixed64(v: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.offset, v, true);
    this.offset += 8;
  }

  writeFloat(v: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, v, true);
    this.offset += 4;
  }

  writeDouble(v: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, v, true);
    this.offset += 8;
  }

  writeBytes(b: Uint8Array): void {
    this.ensureCapacity(b.byteLength);
    this.data.set(b, this.offset);
    this.offset += b.byteLength;
  }

  writeTag(fieldNumber: number, wireType: number): void {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeLenPrefixed(bytes: Uint8Array): void {
    this.writeVarint(bytes.byteLength);
    this.writeBytes(bytes);
  }

  result(): Uint8Array {
    return this.data.subarray(0, this.offset);
  }
}

// ── Buffer reader ──

class PbReader {
  private data: Uint8Array;
  private view: DataView;
  offset: number;
  private limit: number;

  constructor(data: Uint8Array, start = 0, end?: number) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = start;
    this.limit = end ?? data.byteLength;
  }

  atEnd(): boolean {
    return this.offset >= this.limit;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = this.data[this.offset++]!;
      result |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    return result >>> 0;
  }

  readVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    let b: number;
    do {
      b = this.data[this.offset++]!;
      result |= BigInt(b & 0x7f) << shift;
      shift += 7n;
    } while (b & 0x80);
    return result;
  }

  readSignedVarint(): number {
    return Number(BigInt.asIntN(32, this.readVarint64()));
  }

  readSignedVarint64(): bigint {
    return BigInt.asIntN(64, this.readVarint64());
  }

  readFixed32(): number {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readFixed64(): bigint {
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }

  readFloat(): number {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readDouble(): number {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  readBytes(n: number): Uint8Array {
    const sub = this.data.subarray(this.offset, this.offset + n);
    this.offset += n;
    return sub;
  }

  readTag(): { fieldNumber: number; wireType: number } | null {
    if (this.atEnd()) return null;
    const tag = this.readVarint();
    return { fieldNumber: tag >>> 3, wireType: tag & 0x07 };
  }

  subReader(len: number): PbReader {
    const end = this.offset + len;
    const sub = new PbReader(this.data, this.offset, end);
    this.offset = end;
    return sub;
  }

  skip(wireType: number): void {
    switch (wireType) {
      case PB_VARINT: this.readVarint64(); break;
      case PB_I64: this.offset += 8; break;
      case PB_LEN: { const n = this.readVarint(); this.offset += n; break; }
      case PB_I32: this.offset += 4; break;
      default: break;
    }
  }
}

// ── Type mapping helpers ──

const PRIMITIVE_SET = new Set([
  'bool', 'byte', 'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
  'float', 'double', 'string', 'binary',
  'datetime', 'timestamp', 'date', 'time', 'decimal', 'numeric',
  'i8', 'i16', 'i32', 'i64'
]);

function resolve(t: string): string {
  switch (t) { case 'i8': return 'int8'; case 'i16': return 'int16'; case 'i32': return 'int32'; case 'i64': return 'int64'; default: return t; }
}

function protoWireTypeForPrimitive(prim: string): number {
  switch (prim) {
    case 'bool': case 'byte': case 'int8': case 'uint8':
    case 'int16': case 'uint16':
    case 'int32': case 'uint32':
    case 'int64': case 'uint64':
    case 'date': case 'time':
    case 'datetime': case 'timestamp':
      return PB_VARINT;
    case 'float':
      return PB_I32;
    case 'double':
      return PB_I64;
    case 'string': case 'binary': case 'decimal': case 'numeric':
      return PB_LEN;
    default:
      return PB_LEN;
  }
}

type Ctx = { root: DeukPackStruct; defs: Record<string, DeukPackStruct> };

function lookupStruct(name: string, ctx: Ctx): DeukPackStruct {
  if (name === ctx.root.name) return ctx.root;
  const s = ctx.defs[name];
  if (!s) throw new Error(`[DeukPack] proto: missing struct def "${name}"`);
  return s;
}

function structNameForField(field: DeukPackField): string {
  if (field.structType) return field.structType;
  const t = field.type;
  if (typeof t === 'string' && !PRIMITIVE_SET.has(t) && !field.enumValues) return t;
  if (typeof t === 'object' && t !== null && 'structType' in t) return (t as { structType: string }).structType;
  throw new Error(`[DeukPack] proto: cannot resolve struct name for "${field.name}"`);
}

function isPackableType(prim: string): boolean {
  switch (prim) {
    case 'bool': case 'byte': case 'int8': case 'uint8':
    case 'int16': case 'uint16': case 'int32': case 'uint32':
    case 'int64': case 'uint64': case 'float': case 'double':
    case 'date': case 'time': case 'datetime': case 'timestamp':
      return true;
    default:
      return false;
  }
}

// ── Serialize ──

function writeStruct(w: PbWriter, obj: Record<string, unknown>, struct: DeukPackStruct, ctx: Ctx): void {
  for (const field of struct.fields) {
    const raw = obj[field.name];
    if (raw === undefined || raw === null) continue;
    writeField(w, raw, field, ctx);
  }
}

function writeField(w: PbWriter, value: unknown, field: DeukPackField, ctx: Ctx): void {
  const t = field.type;

  if (field.enumValues) {
    w.writeTag(field.id, PB_VARINT);
    const n = typeof value === 'number' ? value : (field.enumValues[value as string] ?? 0);
    w.writeSignedVarint(n);
    return;
  }

  if (typeof t === 'string') {
    const r = resolve(t);
    if (PRIMITIVE_SET.has(t)) {
      writePrimitiveField(w, field.id, r, value);
      return;
    }
    const child = lookupStruct(structNameForField(field), ctx);
    w.writeTag(field.id, PB_LEN);
    const sub = new PbWriter(4096);
    writeStruct(sub, value as Record<string, unknown>, child, ctx);
    w.writeLenPrefixed(sub.result());
    return;
  }

  if (typeof t === 'object' && t !== null && 'type' in t) {
    const o = t as { type: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
    if (o.type === 'list' || o.type === 'set') {
      writeRepeatedField(w, field.id, o.elementType!, value as unknown[], ctx);
      return;
    }
    if (o.type === 'map') {
      writeMapField(w, field.id, o.keyType!, o.valueType!, value, ctx);
      return;
    }
    if (o.type === 'tablelink') {
      w.writeTag(field.id, PB_VARINT);
      w.writeVarint64(BigInt(Number(value)));
      return;
    }
  }
  throw new Error(`[DeukPack] proto: unsupported field type for "${field.name}"`);
}

function writePrimitiveField(w: PbWriter, fieldId: number, prim: string, value: unknown): void {
  const wt = protoWireTypeForPrimitive(prim);
  w.writeTag(fieldId, wt);
  writePrimitiveValue(w, prim, value);
}

function writePrimitiveValue(w: PbWriter, prim: string, value: unknown): void {
  switch (prim) {
    case 'bool': w.writeVarint(value ? 1 : 0); break;
    case 'byte': case 'int8': case 'uint8': w.writeVarint(Number(value) & 0xff); break;
    case 'int16': case 'uint16': w.writeSignedVarint(Number(value)); break;
    case 'int32': case 'uint32': case 'date': case 'time': w.writeSignedVarint(Number(value)); break;
    case 'int64': case 'uint64': case 'datetime': case 'timestamp':
      w.writeVarint64(typeof value === 'bigint' ? value : BigInt(Number(value)));
      break;
    case 'float': w.writeFloat(Number(value)); break;
    case 'double': w.writeDouble(Number(value)); break;
    case 'string': case 'decimal': case 'numeric': {
      const bytes = new TextEncoder().encode(value != null ? String(value) : '');
      w.writeLenPrefixed(bytes);
      break;
    }
    case 'binary': {
      const u8 = value instanceof Uint8Array ? value : (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)
        ? new Uint8Array((value as Buffer).buffer, (value as Buffer).byteOffset, (value as Buffer).byteLength)
        : new Uint8Array());
      w.writeLenPrefixed(u8);
      break;
    }
    default: throw new Error(`[DeukPack] proto: unsupported primitive "${prim}"`);
  }
}

function writeRepeatedField(w: PbWriter, fieldId: number, elementType: DeukPackType, arr: unknown[], ctx: Ctx): void {
  if (!Array.isArray(arr) || arr.length === 0) return;

  // Packed encoding for packable primitives
  if (typeof elementType === 'string') {
    const r = resolve(elementType);
    if (PRIMITIVE_SET.has(elementType) && isPackableType(r)) {
      w.writeTag(fieldId, PB_LEN);
      const sub = new PbWriter(arr.length * 8);
      for (const item of arr) writePrimitiveValue(sub, r, item);
      w.writeLenPrefixed(sub.result());
      return;
    }
  }

  // Non-packed: individual tagged records
  for (const item of arr) {
    writeElementTagged(w, fieldId, elementType, item, ctx);
  }
}

function writeElementTagged(w: PbWriter, fieldId: number, elementType: DeukPackType, value: unknown, ctx: Ctx): void {
  const syn: DeukPackField = { id: fieldId, name: '_el', type: elementType, required: true };
  writeField(w, value, syn, ctx);
}

function writeMapField(w: PbWriter, fieldId: number, keyType: DeukPackType, valueType: DeukPackType, value: unknown, ctx: Ctx): void {
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as Record<string, unknown>);
  for (const [k, v] of entries) {
    w.writeTag(fieldId, PB_LEN);
    const sub = new PbWriter(256);
    const keyField: DeukPackField = { id: 1, name: 'key', type: keyType, required: true };
    const valField: DeukPackField = { id: 2, name: 'value', type: valueType, required: true };
    writeField(sub, k, keyField, ctx);
    writeField(sub, v, valField, ctx);
    w.writeLenPrefixed(sub.result());
  }
}

// ── Deserialize ──

function readStruct(r: PbReader, struct: DeukPackStruct, ctx: Ctx): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fieldById = new Map<number, DeukPackField>();
  for (const f of struct.fields) fieldById.set(f.id, f);

  while (!r.atEnd()) {
    const tag = r.readTag();
    if (!tag || tag.fieldNumber === 0) break;
    const field = fieldById.get(tag.fieldNumber);
    if (!field) {
      r.skip(tag.wireType);
      continue;
    }
    const v = readFieldValue(r, tag.wireType, field, ctx);
    if (isRepeatedField(field)) {
      const existing = out[field.name];
      if (Array.isArray(existing)) {
        if (Array.isArray(v)) existing.push(...v);
        else existing.push(v);
      } else {
        out[field.name] = Array.isArray(v) ? v : [v];
      }
    } else if (isMapField(field)) {
      if (!out[field.name]) out[field.name] = new Map();
      const m = out[field.name] as Map<unknown, unknown>;
      if (v && typeof v === 'object' && 'key' in (v as Record<string, unknown>) && 'value' in (v as Record<string, unknown>)) {
        const entry = v as { key: unknown; value: unknown };
        m.set(entry.key, entry.value);
      }
    } else {
      out[field.name] = v;
    }
  }
  return out;
}

function isRepeatedField(field: DeukPackField): boolean {
  const t = field.type;
  return typeof t === 'object' && t !== null && 'type' in t &&
    ((t as { type: string }).type === 'list' || (t as { type: string }).type === 'set');
}

function isMapField(field: DeukPackField): boolean {
  const t = field.type;
  return typeof t === 'object' && t !== null && 'type' in t && (t as { type: string }).type === 'map';
}

function readFieldValue(r: PbReader, wireType: number, field: DeukPackField, ctx: Ctx): unknown {
  const t = field.type;

  if (field.enumValues) {
    return r.readSignedVarint();
  }

  if (typeof t === 'string') {
    const rs = resolve(t);
    if (PRIMITIVE_SET.has(t)) return readPrimitiveValue(r, wireType, rs);
    // struct
    const len = r.readVarint();
    const sub = r.subReader(len);
    const child = lookupStruct(structNameForField(field), ctx);
    return readStruct(sub, child, ctx);
  }

  if (typeof t === 'object' && t !== null && 'type' in t) {
    const o = t as { type: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
    if (o.type === 'list' || o.type === 'set') {
      return readRepeatedValue(r, wireType, o.elementType!, ctx);
    }
    if (o.type === 'map') {
      return readMapEntry(r, o.keyType!, o.valueType!, ctx);
    }
    if (o.type === 'tablelink') {
      return r.readVarint64();
    }
  }
  r.skip(wireType);
  return undefined;
}

function readPrimitiveValue(r: PbReader, wireType: number, prim: string): unknown {
  switch (prim) {
    case 'bool': return (wireType === PB_VARINT ? r.readVarint() : r.readVarint()) !== 0;
    case 'byte': case 'int8': case 'uint8': return r.readVarint() & 0xff;
    case 'int16': case 'uint16': return r.readSignedVarint() & 0xffff;
    case 'int32': case 'uint32': case 'date': case 'time': return r.readSignedVarint();
    case 'int64': case 'uint64': case 'datetime': case 'timestamp': return r.readSignedVarint64();
    case 'float':
      if (wireType === PB_I32) return r.readFloat();
      return r.readFloat();
    case 'double':
      if (wireType === PB_I64) return r.readDouble();
      return r.readDouble();
    case 'string': case 'decimal': case 'numeric': {
      const len = r.readVarint();
      const bytes = r.readBytes(len);
      return new TextDecoder().decode(bytes);
    }
    case 'binary': {
      const len = r.readVarint();
      return new Uint8Array(r.readBytes(len));
    }
    default: {
      r.skip(wireType);
      return undefined;
    }
  }
}

function readRepeatedValue(r: PbReader, wireType: number, elementType: DeukPackType, ctx: Ctx): unknown {
  if (wireType === PB_LEN && typeof elementType === 'string' && PRIMITIVE_SET.has(elementType)) {
    const rs = resolve(elementType);
    if (isPackableType(rs)) {
      const len = r.readVarint();
      const sub = r.subReader(len);
      const result: unknown[] = [];
      while (!sub.atEnd()) {
        result.push(readPrimitiveValue(sub, protoWireTypeForPrimitive(rs), rs));
      }
      return result;
    }
  }
  // Single element (non-packed)
  const syn: DeukPackField = { id: 0, name: '_el', type: elementType, required: true };
  return readFieldValue(r, wireType, syn, ctx);
}

function readMapEntry(r: PbReader, keyType: DeukPackType, valueType: DeukPackType, ctx: Ctx): { key: unknown; value: unknown } {
  const len = r.readVarint();
  const sub = r.subReader(len);
  let key: unknown;
  let value: unknown;
  while (!sub.atEnd()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1) {
      const kf: DeukPackField = { id: 1, name: 'key', type: keyType, required: true };
      key = readFieldValue(sub, tag.wireType, kf, ctx);
    } else if (tag.fieldNumber === 2) {
      const vf: DeukPackField = { id: 2, name: 'value', type: valueType, required: true };
      value = readFieldValue(sub, tag.wireType, vf, ctx);
    } else {
      sub.skip(tag.wireType);
    }
  }
  return { key, value };
}

// ── Public API ──

export function serializeProtoStruct(
  obj: Record<string, unknown>,
  options: SerializationOptions & { interopRootStruct: DeukPackStruct; interopStructDefs?: Record<string, DeukPackStruct> }
): Uint8Array {
  const ctx: Ctx = { root: options.interopRootStruct, defs: options.interopStructDefs ?? {} };
  const w = new PbWriter();
  writeStruct(w, obj, options.interopRootStruct, ctx);
  return w.result();
}

export function deserializeProtoStruct(
  data: Uint8Array,
  options: SerializationOptions & { interopRootStruct: DeukPackStruct; interopStructDefs?: Record<string, DeukPackStruct> }
): Record<string, unknown> {
  const ctx: Ctx = { root: options.interopRootStruct, defs: options.interopStructDefs ?? {} };
  const r = new PbReader(data);
  return readStruct(r, options.interopRootStruct, ctx);
}

/**
 * Varint utility: ZigZag encode/decode for sint32/sint64.
 * DeukPack int32/int64 maps to protobuf int32/int64 (two's complement varint) by default.
 * Use ZigZag when interop-ing with .proto files that declare sint32/sint64.
 */
export const zigzag = {
  encode32: (n: number): number => ((n << 1) ^ (n >> 31)) >>> 0,
  decode32: (n: number): number => ((n >>> 1) ^ -(n & 1)) | 0,
  encode64: (n: bigint): bigint => (n << 1n) ^ (n >> 63n),
  decode64: (n: bigint): bigint => (n >> 1n) ^ -(n & 1n),
};
