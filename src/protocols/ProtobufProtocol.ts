/**
 * Google Protobuf binary wire format (v2/v3 compatible).
 * Tag: varint (field_number << 3 | proto_wire_type). Sub-messages: LEN-prefixed.
 * Uses buffer stack for nested struct length-prefixing.
 * Read side accepts optional field schema map (field_id → DpWireType) for accurate type recovery;
 * without schema, best-effort mapping from proto wire type (3-bit) to DpWireType.
 */

import { DpWireType, type DpProtocol, type DpStruct, type DpField, type DpList, type DpSet, type DpMap } from './WireProtocol';

export class DpProtobufProtocol implements DpProtocol {
  private bufferStack: { data: Uint8Array; offset: number; capacity: number }[];
  private fieldSchemas: Map<number, DpWireType> | null;
  private listState: { elementType: DpWireType; remaining: number; packed: boolean; lenPos: number } | null = null;

  constructor(buffer: ArrayBuffer, fieldSchemas?: Map<number, DpWireType>) {
    const u8 = new Uint8Array(buffer);
    this.bufferStack = [{ data: u8, offset: 0, capacity: u8.byteLength }];
    this.fieldSchemas = fieldSchemas ?? null;
  }

  private cur(): { data: Uint8Array; offset: number; capacity: number } {
    return this.bufferStack[this.bufferStack.length - 1]!;
  }

  private ensureCapacity(extra: number): void {
    const c = this.cur();
    if (c.offset + extra <= c.capacity) return;
    const needed = c.offset + extra;
    const newCap = Math.max(needed, c.capacity * 2);
    const newData = new Uint8Array(newCap);
    newData.set(c.data.subarray(0, c.offset));
    c.data = newData;
    c.capacity = newCap;
  }

  private writeByteDirect(v: number): void {
    this.ensureCapacity(1);
    const c = this.cur();
    c.data[c.offset++] = v & 0xff;
  }

  private writeRawVarint(value: number): void {
    let v = value >>> 0;
    while (v > 0x7f) {
      this.writeByteDirect((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    this.writeByteDirect(v & 0x7f);
  }

  private writeRawVarint64(value: bigint): void {
    let v = BigInt.asUintN(64, value);
    while (v > 0x7fn) {
      this.writeByteDirect(Number((v & 0x7fn) | 0x80n));
      v >>= 7n;
    }
    this.writeByteDirect(Number(v & 0x7fn));
  }

  private readByteDirect(): number {
    const c = this.cur();
    return c.data[c.offset++]!;
  }

  private readRawVarint(): number {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = this.readByteDirect();
      result |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    return result >>> 0;
  }

  private readRawVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    let b: number;
    do {
      b = this.readByteDirect();
      result |= BigInt(b & 0x7f) << shift;
      shift += 7n;
    } while (b & 0x80);
    return result;
  }

  static protoWireTypeForDp(dpType: DpWireType): number {
    switch (dpType) {
      case DpWireType.Bool:
      case DpWireType.Byte:
      case DpWireType.Int16:
      case DpWireType.Int32:
      case DpWireType.Int64:
        return 0; // VARINT
      case DpWireType.Double:
        return 1; // I64
      case DpWireType.String:
      case DpWireType.Struct:
      case DpWireType.List:
      case DpWireType.Set:
      case DpWireType.Map:
        return 2; // LEN
      default:
        return 0;
    }
  }

  static dpWireTypeFromProto(protoWireType: number, fieldSchema?: DpWireType): DpWireType {
    if (fieldSchema !== undefined) return fieldSchema;
    switch (protoWireType) {
      case 0: return DpWireType.Int64;   // VARINT → most general integer
      case 1: return DpWireType.Double;  // I64
      case 2: return DpWireType.String;  // LEN (could be string, bytes, sub-message, packed)
      case 5: return DpWireType.Int32;   // I32 (float/fixed32)
      default: return DpWireType.Byte;
    }
  }

  // ── Write ──

  writeStructBegin(_struct: DpStruct): void {
    if (this.bufferStack.length > 1) return;
  }

  writeStructEnd(): void {
    if (this.bufferStack.length <= 1) return;
    const child = this.bufferStack.pop()!;
    const childBytes = child.data.subarray(0, child.offset);
    this.writeRawVarint(childBytes.byteLength);
    this.ensureCapacity(childBytes.byteLength);
    const c = this.cur();
    c.data.set(childBytes, c.offset);
    c.offset += childBytes.byteLength;
  }

  writeFieldBegin(field: DpField): void {
    if (field.type === DpWireType.Stop) return;
    const protoWire = DpProtobufProtocol.protoWireTypeForDp(field.type);
    this.writeRawVarint((field.id << 3) | protoWire);
    if (field.type === DpWireType.Struct) {
      this.bufferStack.push({ data: new Uint8Array(256), offset: 0, capacity: 256 });
    }
  }

  writeFieldEnd(): void {}

  writeFieldStop(): void {}

  writeBool(value: boolean): void {
    this.writeRawVarint(value ? 1 : 0);
  }

  writeByte(value: number): void {
    this.writeRawVarint(value & 0xff);
  }

  writeI16(value: number): void {
    this.writeRawVarint(value & 0xffff);
  }

  writeI32(value: number): void {
    this.writeRawVarint(value >>> 0);
  }

  writeI64(value: bigint): void {
    this.writeRawVarint64(value);
  }

  writeDouble(value: number): void {
    this.ensureCapacity(8);
    const c = this.cur();
    const tmp = new DataView(c.data.buffer, c.data.byteOffset + c.offset, 8);
    tmp.setFloat64(0, value, true);
    c.offset += 8;
  }

  writeString(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.writeRawVarint(bytes.byteLength);
    this.ensureCapacity(bytes.byteLength);
    const c = this.cur();
    c.data.set(bytes, c.offset);
    c.offset += bytes.byteLength;
  }

  writeBinary(value: Uint8Array): void {
    this.writeRawVarint(value.byteLength);
    this.ensureCapacity(value.byteLength);
    const c = this.cur();
    c.data.set(value, c.offset);
    c.offset += value.byteLength;
  }

  writeListBegin(list: DpList): void {
    const isPackable = list.elementType === DpWireType.Bool
      || list.elementType === DpWireType.Byte
      || list.elementType === DpWireType.Int16
      || list.elementType === DpWireType.Int32
      || list.elementType === DpWireType.Int64
      || list.elementType === DpWireType.Double;
    if (isPackable) {
      this.listState = { elementType: list.elementType, remaining: list.count, packed: true, lenPos: 0 };
      this.bufferStack.push({ data: new Uint8Array(256), offset: 0, capacity: 256 });
    } else {
      this.listState = { elementType: list.elementType, remaining: list.count, packed: false, lenPos: 0 };
    }
  }

  writeListEnd(): void {
    if (this.listState?.packed && this.bufferStack.length > 1) {
      const child = this.bufferStack.pop()!;
      const childBytes = child.data.subarray(0, child.offset);
      this.writeRawVarint(childBytes.byteLength);
      this.ensureCapacity(childBytes.byteLength);
      const c = this.cur();
      c.data.set(childBytes, c.offset);
      c.offset += childBytes.byteLength;
    }
    this.listState = null;
  }

  writeSetBegin(set: DpSet): void {
    this.writeListBegin({ elementType: set.elementType, count: set.count });
  }

  writeSetEnd(): void {
    this.writeListEnd();
  }

  writeMapBegin(map: DpMap): void {
    this.listState = { elementType: DpWireType.Struct, remaining: map.count * 2, packed: false, lenPos: 0 };
  }

  writeMapEnd(): void {
    this.listState = null;
  }

  // ── Read ──

  readStructBegin(): DpStruct {
    return { name: '' };
  }

  readStructEnd(): void {
    if (this.bufferStack.length > 1) {
      this.bufferStack.pop();
    }
  }

  readFieldBegin(): DpField {
    const c = this.cur();
    if (c.offset >= c.data.byteLength) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const peek = c.data[c.offset];
    if (peek === 0) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const tag = this.readRawVarint();
    if (tag === 0) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const protoWireType = tag & 0x07;
    const fieldNumber = tag >>> 3;
    const schema = this.fieldSchemas?.get(fieldNumber);
    const dpType = DpProtobufProtocol.dpWireTypeFromProto(protoWireType, schema);
    return { name: '', type: dpType, id: fieldNumber };
  }

  readFieldEnd(): void {}

  readBool(): boolean {
    return this.readRawVarint() !== 0;
  }

  readByte(): number {
    return this.readRawVarint() & 0xff;
  }

  readI16(): number {
    const v = this.readRawVarint();
    return (v << 16) >> 16;
  }

  readI32(): number {
    return this.readRawVarint() | 0;
  }

  readI64(): bigint {
    return BigInt.asIntN(64, this.readRawVarint64());
  }

  readDouble(): number {
    const c = this.cur();
    const tmp = new DataView(c.data.buffer, c.data.byteOffset + c.offset, 8);
    const v = tmp.getFloat64(0, true);
    c.offset += 8;
    return v;
  }

  readString(): string {
    const len = this.readRawVarint();
    const c = this.cur();
    const bytes = c.data.subarray(c.offset, c.offset + len);
    c.offset += len;
    return new TextDecoder().decode(bytes);
  }

  readBinary(): Uint8Array {
    const len = this.readRawVarint();
    const c = this.cur();
    const bytes = new Uint8Array(c.data.subarray(c.offset, c.offset + len));
    c.offset += len;
    return bytes;
  }

  readListBegin(): DpList {
    const len = this.readRawVarint();
    const c = this.cur();
    const subData = c.data.subarray(c.offset, c.offset + len);
    c.offset += len;
    this.bufferStack.push({ data: subData, offset: 0, capacity: subData.byteLength });
    const schema = this.fieldSchemas?.get(0);
    const elementType = schema ?? DpWireType.Int32;
    let count = 0;
    const saved = this.cur().offset;
    const sub = this.cur();
    while (sub.offset < sub.data.byteLength) {
      this.skipProtoValue(DpProtobufProtocol.protoWireTypeForDp(elementType));
      count++;
    }
    sub.offset = saved;
    return { elementType, count };
  }

  readListEnd(): void {
    if (this.bufferStack.length > 1) {
      this.bufferStack.pop();
    }
  }

  readSetBegin(): DpSet {
    const list = this.readListBegin();
    return { elementType: list.elementType, count: list.count };
  }

  readSetEnd(): void {
    this.readListEnd();
  }

  readMapBegin(): DpMap {
    return { keyType: DpWireType.String, valueType: DpWireType.Int32, count: 0 };
  }

  readMapEnd(): void {}

  private skipProtoValue(protoWireType: number): void {
    switch (protoWireType) {
      case 0: this.readRawVarint(); break;
      case 1: this.cur().offset += 8; break;
      case 2: { const n = this.readRawVarint(); this.cur().offset += n; break; }
      case 5: this.cur().offset += 4; break;
      default: break;
    }
  }

  // ── Utility ──

  getBuffer(): ArrayBuffer {
    const c = this.bufferStack[0]!;
    return (c.data.buffer as ArrayBuffer).slice(c.data.byteOffset, c.data.byteOffset + c.offset);
  }

  getOffset(): number {
    return this.cur().offset;
  }

  setOffset(offset: number): void {
    this.cur().offset = offset;
  }

  setFieldSchemas(schemas: Map<number, DpWireType>): void {
    this.fieldSchemas = schemas;
  }

  static zigzagEncode32(n: number): number {
    return ((n << 1) ^ (n >> 31)) >>> 0;
  }

  static zigzagDecode32(n: number): number {
    return ((n >>> 1) ^ -(n & 1)) | 0;
  }

  static zigzagEncode64(n: bigint): bigint {
    return (n << 1n) ^ (n >> 63n);
  }

  static zigzagDecode64(n: bigint): bigint {
    return (n >> 1n) ^ -(n & 1n);
  }
}
