/**
 * DeukPack Wire Protocol
 * DpProtocol interface and implementations.
 * - DpBinaryProtocol, DpCompactProtocol: Apache Thrift wire-compatible (binary/compact).
 * - DpPackProtocol: DeukPack-native (magic 0x44 0x50 0x01); detectable via detectWireProtocol().
 * - 엔벨로프(writeEnvelope/readEnvelope): 팩 시 프로토콜 타입 저장 → 언팩 시 타입으로 디코더 선택. 기본(성능·메모리 권장): pack.
 * - Cross-platform serialization with endian support.
 */

export enum DpWireType {
  Stop = 0,
  Void = 1,
  Bool = 2,
  Byte = 3,
  Double = 4,
  I16 = 6,
  I32 = 8,
  I64 = 10,
  String = 11,
  Struct = 12,
  Map = 13,
  Set = 14,
  List = 15
}

export enum DpMessageType {
  Call = 1,
  Reply = 2,
  Exception = 3,
  Oneway = 4
}

export interface DpStruct {
  name: string;
}

export interface DpField {
  name: string;
  type: DpWireType;
  id: number;
}

export interface DpList {
  elementType: DpWireType;
  count: number;
}

export interface DpSet {
  elementType: DpWireType;
  count: number;
}

export interface DpMap {
  keyType: DpWireType;
  valueType: DpWireType;
  count: number;
}

export interface DpProtocol {
  writeStructBegin(struct: DpStruct): void;
  writeStructEnd(): void;
  writeFieldBegin(field: DpField): void;
  writeFieldEnd(): void;
  writeFieldStop(): void;
  writeBool(value: boolean): void;
  writeByte(value: number): void;
  writeI16(value: number): void;
  writeI32(value: number): void;
  writeI64(value: bigint): void;
  writeDouble(value: number): void;
  writeString(value: string): void;
  writeBinary(value: Uint8Array): void;
  writeListBegin(list: DpList): void;
  writeListEnd(): void;
  writeSetBegin(set: DpSet): void;
  writeSetEnd(): void;
  writeMapBegin(map: DpMap): void;
  writeMapEnd(): void;

  readStructBegin(): DpStruct;
  readStructEnd(): void;
  readFieldBegin(): DpField;
  readFieldEnd(): void;
  readBool(): boolean;
  readByte(): number;
  readI16(): number;
  readI32(): number;
  readI64(): bigint;
  readDouble(): number;
  readString(): string;
  readBinary(): Uint8Array;
  readListBegin(): DpList;
  readListEnd(): void;
  readSetBegin(): DpSet;
  readSetEnd(): void;
  readMapBegin(): DpMap;
  readMapEnd(): void;
}

/**
 * Thrift-compatible binary protocol (fixed-width fields, type+id per field).
 * Endianness configurable (default little-endian); Apache Thrift binary is big-endian.
 */
export class DpBinaryProtocol implements DpProtocol {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;

  constructor(buffer: ArrayBuffer, littleEndian: boolean = true) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  // Write methods
  writeStructBegin(_struct: DpStruct): void {
    // Binary protocol doesn't write struct names
  }

  writeStructEnd(): void {
    // Binary protocol doesn't write struct end markers
  }

  writeFieldBegin(field: DpField): void {
    this.writeByte(field.type);
    this.writeI16(field.id);
  }

  writeFieldEnd(): void {
    // Binary protocol doesn't write field end markers
  }

  writeFieldStop(): void {
    this.writeByte(DpWireType.Stop);
  }

  writeBool(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }

  writeByte(value: number): void {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeI16(value: number): void {
    this.view.setInt16(this.offset, value, this.littleEndian);
    this.offset += 2;
  }

  writeI32(value: number): void {
    this.view.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeI64(value: bigint): void {
    this.view.setBigInt64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  writeDouble(value: number): void {
    this.view.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeI32(bytes.length);
    this.writeBinary(new Uint8Array(bytes));
  }

  writeBinary(value: Uint8Array): void {
    this.writeI32(value.length);
    new Uint8Array(this.buffer, this.offset, value.length).set(value);
    this.offset += value.length;
  }

  writeListBegin(list: DpList): void {
    this.writeByte(list.elementType);
    this.writeI32(list.count);
  }

  writeListEnd(): void {
    // Binary protocol doesn't write list end markers
  }

  writeSetBegin(set: DpSet): void {
    this.writeByte(set.elementType);
    this.writeI32(set.count);
  }

  writeSetEnd(): void {
    // Binary protocol doesn't write set end markers
  }

  writeMapBegin(map: DpMap): void {
    this.writeByte(map.keyType);
    this.writeByte(map.valueType);
    this.writeI32(map.count);
  }

  writeMapEnd(): void {
    // Binary protocol doesn't write map end markers
  }

  // Read methods
  readStructBegin(): DpStruct {
    return { name: '' };
  }

  readStructEnd(): void {
    // Binary protocol doesn't read struct end markers
  }

  readFieldBegin(): DpField {
    const type = this.readByte();
    if (type === DpWireType.Stop) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const id = this.readI16();
    return { name: '', type: type as DpWireType, id };
  }

  readFieldEnd(): void {
    // Binary protocol doesn't read field end markers
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readI16(): number {
    const value = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  readI32(): number {
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readI64(): bigint {
    const value = this.view.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readDouble(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readString(): string {
    const length = this.readI32();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  readBinary(): Uint8Array {
    const length = this.readI32();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }

  readListBegin(): DpList {
    const elementType = this.readByte();
    const count = this.readI32();
    return { elementType: elementType as DpWireType, count };
  }

  readListEnd(): void {
    // Binary protocol doesn't read list end markers
  }

  readSetBegin(): DpSet {
    const elementType = this.readByte();
    const count = this.readI32();
    return { elementType: elementType as DpWireType, count };
  }

  readSetEnd(): void {
    // Binary protocol doesn't read set end markers
  }

  readMapBegin(): DpMap {
    const keyType = this.readByte();
    const valueType = this.readByte();
    const count = this.readI32();
    return { keyType: keyType as DpWireType, valueType: valueType as DpWireType, count };
  }

  readMapEnd(): void {
    // Binary protocol doesn't read map end markers
  }

  // Utility methods
  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }
}

/**
 * 제로카피 프로토콜 (Zero-Copy Protocol). 기본 선택사항 아님 — 사용자가 writeEnvelope(..., 'zerocopy') 또는 엔벨로프 id 3으로 명시할 때만 사용.
 * Wire 포맷은 Thrift Binary와 동일. read 시 버퍼 복사 없이 뷰(Uint8Array) 반환.
 * 주의: 반환된 뷰 사용 중에는 원본 버퍼를 수정하지 말 것. 버퍼 수명이 뷰보다 길어야 함.
 */
export class DpZeroCopyProtocol implements DpProtocol {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;

  constructor(buffer: ArrayBuffer, littleEndian: boolean = true) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  writeStructBegin(_struct: DpStruct): void {}
  writeStructEnd(): void {}
  writeFieldBegin(field: DpField): void {
    this.writeByte(field.type);
    this.writeI16(field.id);
  }
  writeFieldEnd(): void {}
  writeFieldStop(): void {
    this.writeByte(DpWireType.Stop);
  }
  writeBool(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }
  writeByte(value: number): void {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }
  writeI16(value: number): void {
    this.view.setInt16(this.offset, value, this.littleEndian);
    this.offset += 2;
  }
  writeI32(value: number): void {
    this.view.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }
  writeI64(value: bigint): void {
    this.view.setBigInt64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }
  writeDouble(value: number): void {
    this.view.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }
  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeI32(bytes.length);
    this.writeBinary(new Uint8Array(bytes));
  }
  writeBinary(value: Uint8Array): void {
    this.writeI32(value.length);
    new Uint8Array(this.buffer, this.offset, value.length).set(value);
    this.offset += value.length;
  }
  writeListBegin(list: DpList): void {
    this.writeByte(list.elementType);
    this.writeI32(list.count);
  }
  writeListEnd(): void {}
  writeSetBegin(set: DpSet): void {
    this.writeByte(set.elementType);
    this.writeI32(set.count);
  }
  writeSetEnd(): void {}
  writeMapBegin(map: DpMap): void {
    this.writeByte(map.keyType);
    this.writeByte(map.valueType);
    this.writeI32(map.count);
  }
  writeMapEnd(): void {}

  readStructBegin(): DpStruct {
    return { name: '' };
  }
  readStructEnd(): void {}
  readFieldBegin(): DpField {
    const type = this.readByte();
    if (type === DpWireType.Stop) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const id = this.readI16();
    return { name: '', type: type as DpWireType, id };
  }
  readFieldEnd(): void {}
  readBool(): boolean {
    return this.readByte() !== 0;
  }
  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }
  readI16(): number {
    const value = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }
  readI32(): number {
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }
  readI64(): bigint {
    const value = this.view.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  readDouble(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  readString(): string {
    const length = this.readI32();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }
  /** 제로카피: 원본 버퍼에 대한 뷰 반환. 버퍼 수명·불변성 책임은 호출자. */
  readBinary(): Uint8Array {
    const length = this.readI32();
    const view = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return view;
  }
  readListBegin(): DpList {
    const elementType = this.readByte();
    const count = this.readI32();
    return { elementType: elementType as DpWireType, count };
  }
  readListEnd(): void {}
  readSetBegin(): DpSet {
    const elementType = this.readByte();
    const count = this.readI32();
    return { elementType: elementType as DpWireType, count };
  }
  readSetEnd(): void {}
  readMapBegin(): DpMap {
    const keyType = this.readByte();
    const valueType = this.readByte();
    const count = this.readI32();
    return { keyType: keyType as DpWireType, valueType: valueType as DpWireType, count };
  }
  readMapEnd(): void {}

  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }
  getOffset(): number {
    return this.offset;
  }
  setOffset(offset: number): void {
    this.offset = offset;
  }
}

/**
 * Thrift-compatible compact protocol (varint encoding, smaller payload).
 * Same wire format family as Apache Thrift compact.
 */
export class DpCompactProtocol implements DpProtocol {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;

  constructor(buffer: ArrayBuffer, littleEndian: boolean = true) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  // Compact protocol uses variable-length encoding
  writeStructBegin(_struct: DpStruct): void {
    // Compact protocol doesn't write struct names
  }

  writeStructEnd(): void {
    // Compact protocol doesn't write struct end markers
  }

  writeFieldBegin(field: DpField): void {
    if (field.type === DpWireType.Stop) {
      this.writeByte(DpWireType.Stop);
    } else {
      this.writeByte((field.id << 4) | field.type);
    }
  }

  writeFieldEnd(): void {
    // Compact protocol doesn't write field end markers
  }

  writeFieldStop(): void {
    this.writeByte(DpWireType.Stop);
  }

  writeBool(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }

  writeByte(value: number): void {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeI16(value: number): void {
    this.writeVarint(value);
  }

  writeI32(value: number): void {
    this.writeVarint(value);
  }

  writeI64(value: bigint): void {
    this.writeVarint64(value);
  }

  writeDouble(value: number): void {
    this.view.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeVarint(bytes.length);
    this.writeBinary(new Uint8Array(bytes));
  }

  writeBinary(value: Uint8Array): void {
    this.writeVarint(value.length);
    new Uint8Array(this.buffer, this.offset, value.length).set(value);
    this.offset += value.length;
  }

  writeListBegin(list: DpList): void {
    this.writeByte((list.elementType << 4) | (list.count < 15 ? list.count : 15));
    if (list.count >= 15) {
      this.writeVarint(list.count - 15);
    }
  }

  writeListEnd(): void {
    // Compact protocol doesn't write list end markers
  }

  writeSetBegin(set: DpSet): void {
    this.writeListBegin({ elementType: set.elementType, count: set.count });
  }

  writeSetEnd(): void {
    // Compact protocol doesn't write set end markers
  }

  writeMapBegin(map: DpMap): void {
    this.writeVarint(map.count);
    if (map.count > 0) {
      this.writeByte((map.keyType << 4) | map.valueType);
    }
  }

  writeMapEnd(): void {
    // Compact protocol doesn't write map end markers
  }

  // Read methods (similar to binary protocol but with varint decoding)
  readStructBegin(): DpStruct {
    return { name: '' };
  }

  readStructEnd(): void {
    // Compact protocol doesn't read struct end markers
  }

  readFieldBegin(): DpField {
    const byte = this.readByte();
    if (byte === DpWireType.Stop) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const type = byte & 0x0F;
    const id = byte >> 4;
    return { name: '', type: type as DpWireType, id };
  }

  readFieldEnd(): void {
    // Compact protocol doesn't read field end markers
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readI16(): number {
    return this.readVarint();
  }

  readI32(): number {
    return this.readVarint();
  }

  readI64(): bigint {
    return this.readVarint64();
  }

  readDouble(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readString(): string {
    const length = this.readVarint();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  readBinary(): Uint8Array {
    const length = this.readVarint();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }

  readListBegin(): DpList {
    const byte = this.readByte();
    const elementType = byte & 0x0F;
    let count = byte >> 4;
    if (count === 15) {
      count = this.readVarint() + 15;
    }
    return { elementType: elementType as DpWireType, count };
  }

  readListEnd(): void {
    // Compact protocol doesn't read list end markers
  }

  readSetBegin(): DpSet {
    const list = this.readListBegin();
    return { elementType: list.elementType, count: list.count };
  }

  readSetEnd(): void {
    // Compact protocol doesn't read set end markers
  }

  readMapBegin(): DpMap {
    const count = this.readVarint();
    if (count === 0) {
      return { keyType: DpWireType.Stop, valueType: DpWireType.Stop, count: 0 };
    }
    const byte = this.readByte();
    const keyType = byte >> 4;
    const valueType = byte & 0x0F;
    return { keyType: keyType as DpWireType, valueType: valueType as DpWireType, count };
  }

  readMapEnd(): void {
    // Compact protocol doesn't read map end markers
  }

  // Varint encoding/decoding
  private writeVarint(value: number): void {
    while (value > 0x7F) {
      this.writeByte((value & 0x7F) | 0x80);
      value >>>= 7;
    }
    this.writeByte(value & 0x7F);
  }

  private readVarint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.readByte();
      result |= (byte & 0x7F) << shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }

  private writeVarint64(value: bigint): void {
    while (value > 0x7Fn) {
      this.writeByte(Number((value & 0x7Fn) | 0x80n));
      value = value >> 7n;
    }
    this.writeByte(Number(value & 0x7Fn));
  }

  private readVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    let byte: number;
    do {
      byte = this.readByte();
      result |= BigInt(byte & 0x7F) << shift;
      shift += 7n;
    } while (byte & 0x80);
    return result;
  }

  // Utility methods
  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }
}

/** Magic header for DpPack wire (3 bytes): 'DP' + version 1. Enables protocol detection from stored bytes. */
export const DP_PACK_MAGIC = new Uint8Array([0x44, 0x50, 0x01]);
const DP_PACK_MAGIC_LEN = 3;

/** Envelope: [0x44, 0x50, version, protocol_id]. Pack/Unpack 시 저장된 프로토콜 타입으로 올바른 디코더 선택. */
export const DP_WIRE_ENVELOPE_SIZE = 4;
export const DP_WIRE_ENVELOPE_MAGIC0 = 0x44;
export const DP_WIRE_ENVELOPE_MAGIC1 = 0x50;

/** Protocol id in envelope: 성능·메모리 기본은 pack(2). 제로카피(3)는 사용자 선택 전용(기본 아님), FlatBuffers 유사·버퍼 뷰 반환. */
export const DP_WIRE_PROTOCOL_BINARY = 0;
export const DP_WIRE_PROTOCOL_COMPACT = 1;
export const DP_WIRE_PROTOCOL_PACK = 2;
export const DP_WIRE_PROTOCOL_ZEROCOPY = 3;

export type DpWireProtocolName = 'binary' | 'compact' | 'pack' | 'zerocopy';

const ENVELOPE_PROTOCOL_TO_ID: Record<DpWireProtocolName, number> = {
  binary: DP_WIRE_PROTOCOL_BINARY,
  compact: DP_WIRE_PROTOCOL_COMPACT,
  pack: DP_WIRE_PROTOCOL_PACK,
  zerocopy: DP_WIRE_PROTOCOL_ZEROCOPY
};

const ENVELOPE_ID_TO_PROTOCOL: Record<number, DpWireProtocolName> = {
  [DP_WIRE_PROTOCOL_BINARY]: 'binary',
  [DP_WIRE_PROTOCOL_COMPACT]: 'compact',
  [DP_WIRE_PROTOCOL_PACK]: 'pack',
  [DP_WIRE_PROTOCOL_ZEROCOPY]: 'zerocopy'
};

/**
 * Pack 시 버퍼 앞에 프로토콜 타입을 씀. 호출 후 동일 버퍼로 프로토콜 생성하고 setOffset(DP_WIRE_ENVELOPE_SIZE) 후 Write.
 * @param buffer 최소 4바이트 이상 확보된 버퍼
 * @param protocol 저장할 프로토콜 (기본·권장: 'pack' — 성능·메모리 양호)
 * @param version 엔벨로프 버전 (기본 1)
 */
export function writeEnvelope(
  buffer: ArrayBuffer,
  protocol: DpWireProtocolName,
  version: number = 1
): void {
  const u8 = new Uint8Array(buffer, 0, DP_WIRE_ENVELOPE_SIZE);
  u8[0] = DP_WIRE_ENVELOPE_MAGIC0;
  u8[1] = DP_WIRE_ENVELOPE_MAGIC1;
  u8[2] = version & 0xff;
  u8[3] = ENVELOPE_PROTOCOL_TO_ID[protocol];
}

/**
 * Unpack 시 저장된 프로토콜 타입 반환. 엔벨로프가 있으면 version·protocol 반환; 없으면 null.
 */
export function readEnvelope(
  buffer: ArrayBuffer | Uint8Array
): { version: number; protocol: DpWireProtocolName } | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < DP_WIRE_ENVELOPE_SIZE ||
      bytes[0] !== DP_WIRE_ENVELOPE_MAGIC0 ||
      bytes[1] !== DP_WIRE_ENVELOPE_MAGIC1) {
    return null;
  }
  const version = (bytes[2] ?? 0) & 0xff;
  const id = (bytes[3] ?? 0) & 0xff;
  const protocol = ENVELOPE_ID_TO_PROTOCOL[id];
  if (protocol === undefined) return null;
  return { version, protocol };
}

/**
 * DeukPack-native wire protocol (pack).
 * Same encoding as Thrift compact (varint tag + varint values) but with a 3-byte magic header
 * so stored payloads can be identified as DpPack. Not wire-compatible with Apache Thrift.
 */
export class DpPackProtocol implements DpProtocol {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;

  constructor(buffer: ArrayBuffer, littleEndian: boolean = true) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  private ensureMagicWritten(): void {
    if (this.offset === 0) {
      new Uint8Array(this.buffer).set(DP_PACK_MAGIC, 0);
      this.offset = DP_PACK_MAGIC_LEN;
    }
  }

  private ensureMagicSkipped(): void {
    if (this.offset === 0 && this.buffer.byteLength >= DP_PACK_MAGIC_LEN) {
      const u8 = new Uint8Array(this.buffer);
      if (u8[0] === DP_PACK_MAGIC[0] && u8[1] === DP_PACK_MAGIC[1] && u8[2] === DP_PACK_MAGIC[2])
        this.offset = DP_PACK_MAGIC_LEN;
    }
  }

  writeStructBegin(_struct: DpStruct): void {
    this.ensureMagicWritten();
  }

  writeStructEnd(): void {}

  writeFieldBegin(field: DpField): void {
    this.ensureMagicWritten();
    if (field.type === DpWireType.Stop) {
      this.writeByte(DpWireType.Stop);
    } else {
      this.writeByte((field.id << 4) | field.type);
    }
  }

  writeFieldEnd(): void {}

  writeFieldStop(): void {
    this.ensureMagicWritten();
    this.writeByte(DpWireType.Stop);
  }

  writeBool(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }

  writeByte(value: number): void {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeI16(value: number): void {
    this.writeVarint(value);
  }

  writeI32(value: number): void {
    this.writeVarint(value);
  }

  writeI64(value: bigint): void {
    this.writeVarint64(value);
  }

  writeDouble(value: number): void {
    this.view.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeVarint(bytes.length);
    new Uint8Array(this.buffer, this.offset, bytes.length).set(bytes);
    this.offset += bytes.length;
  }

  writeBinary(value: Uint8Array): void {
    this.writeVarint(value.length);
    new Uint8Array(this.buffer, this.offset, value.length).set(value);
    this.offset += value.length;
  }

  writeListBegin(list: DpList): void {
    this.writeByte((list.elementType << 4) | (list.count < 15 ? list.count : 15));
    if (list.count >= 15) {
      this.writeVarint(list.count - 15);
    }
  }

  writeListEnd(): void {}

  writeSetBegin(set: DpSet): void {
    this.writeListBegin({ elementType: set.elementType, count: set.count });
  }

  writeSetEnd(): void {}

  writeMapBegin(map: DpMap): void {
    this.writeVarint(map.count);
    if (map.count > 0) {
      this.writeByte((map.keyType << 4) | map.valueType);
    }
  }

  writeMapEnd(): void {}

  readStructBegin(): DpStruct {
    this.ensureMagicSkipped();
    return { name: '' };
  }

  readStructEnd(): void {}

  readFieldBegin(): DpField {
    this.ensureMagicSkipped();
    const byte = this.readByte();
    if (byte === DpWireType.Stop) {
      return { name: '', type: DpWireType.Stop, id: 0 };
    }
    const type = byte & 0x0F;
    const id = byte >> 4;
    return { name: '', type: type as DpWireType, id };
  }

  readFieldEnd(): void {}

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readI16(): number {
    return this.readVarint();
  }

  readI32(): number {
    return this.readVarint();
  }

  readI64(): bigint {
    return this.readVarint64();
  }

  readDouble(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readString(): string {
    const length = this.readVarint();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  readBinary(): Uint8Array {
    const length = this.readVarint();
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new Uint8Array(bytes);
  }

  readListBegin(): DpList {
    const byte = this.readByte();
    const elementType = byte & 0x0F;
    let count = byte >> 4;
    if (count === 15) {
      count = this.readVarint() + 15;
    }
    return { elementType: elementType as DpWireType, count };
  }

  readListEnd(): void {}

  readSetBegin(): DpSet {
    const list = this.readListBegin();
    return { elementType: list.elementType, count: list.count };
  }

  readSetEnd(): void {}

  readMapBegin(): DpMap {
    const count = this.readVarint();
    if (count === 0) {
      return { keyType: DpWireType.Stop, valueType: DpWireType.Stop, count: 0 };
    }
    const byte = this.readByte();
    const keyType = byte >> 4;
    const valueType = byte & 0x0F;
    return { keyType: keyType as DpWireType, valueType: valueType as DpWireType, count };
  }

  readMapEnd(): void {}

  private writeVarint(value: number): void {
    while (value > 0x7F) {
      this.writeByte((value & 0x7F) | 0x80);
      value >>>= 7;
    }
    this.writeByte(value & 0x7F);
  }

  private readVarint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.readByte();
      result |= (byte & 0x7F) << shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }

  private writeVarint64(value: bigint): void {
    while (value > 0x7Fn) {
      this.writeByte(Number((value & 0x7Fn) | 0x80n));
      value = value >> 7n;
    }
    this.writeByte(Number(value & 0x7Fn));
  }

  private readVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    let byte: number;
    do {
      byte = this.readByte();
      result |= BigInt(byte & 0x7F) << shift;
      shift += 7n;
    } while (byte & 0x80);
    return result;
  }

  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }
}

/**
 * Unpack 시 저장된 바이트에서 프로토콜 판별.
 * - 엔벨로프(4바이트)가 있으면 그 안의 프로토콜 타입 반환.
 * - pack 매직(3바이트)만 있으면 'pack'.
 * - 매직이 없으면 Thrift 호환 바이너리로 간주하여 'binary' 반환.
 */
export function detectWireProtocol(buffer: ArrayBuffer | Uint8Array): DpWireProtocolName | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const env = readEnvelope(bytes);
  if (env) return env.protocol;
  if (bytes.length >= DP_PACK_MAGIC_LEN &&
      bytes[0] === DP_PACK_MAGIC[0] &&
      bytes[1] === DP_PACK_MAGIC[1] &&
      bytes[2] === DP_PACK_MAGIC[2]) {
    return 'pack';
  }
  return 'binary';
}

/**
 * Unpack 시 버퍼에서 프로토콜 타입을 읽고, 해당 프로토콜 인스턴스와 바디 시작 오프셋 반환.
 * 엔벨로프 있음 → bodyOffset=4. pack 매직만 있음 → bodyOffset=3. 매직 없음 → Thrift 호환 바이너리, bodyOffset=0.
 */
export function createProtocolForUnpack(
  buffer: ArrayBuffer,
  littleEndian: boolean = true
): { protocol: DpBinaryProtocol | DpCompactProtocol | DpPackProtocol | DpZeroCopyProtocol; bodyOffset: number } {
  const env = readEnvelope(buffer);
  if (env) {
    const proto =
      env.protocol === 'binary' ? new DpBinaryProtocol(buffer, littleEndian)
      : env.protocol === 'compact' ? new DpCompactProtocol(buffer, littleEndian)
      : env.protocol === 'zerocopy' ? new DpZeroCopyProtocol(buffer, littleEndian)
      : new DpPackProtocol(buffer, littleEndian);
    proto.setOffset(DP_WIRE_ENVELOPE_SIZE);
    return { protocol: proto, bodyOffset: DP_WIRE_ENVELOPE_SIZE };
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= DP_PACK_MAGIC_LEN &&
      bytes[0] === DP_PACK_MAGIC[0] &&
      bytes[1] === DP_PACK_MAGIC[1] &&
      bytes[2] === DP_PACK_MAGIC[2]) {
    const proto = new DpPackProtocol(buffer, littleEndian);
    proto.setOffset(DP_PACK_MAGIC_LEN);
    return { protocol: proto, bodyOffset: DP_PACK_MAGIC_LEN };
  }
  const proto = new DpBinaryProtocol(buffer, littleEndian);
  return { protocol: proto, bodyOffset: 0 };
}
