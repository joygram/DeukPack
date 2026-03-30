/**
 * Thrift Compact protocol (tcompact).
 * Varint encoding, smaller payload than binary.
 */

import { DpWireType, type DpProtocol, type DpStruct, type DpField, type DpList, type DpSet, type DpMap } from './WireProtocol';

export class DpTCompactProtocol implements DpProtocol {
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
    if (field.type === DpWireType.Stop) {
      this.writeByte(DpWireType.Stop);
    } else {
      this.writeByte((field.id << 4) | field.type);
    }
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

  private recursionDepth = 0;
  private static readonly MAX_RECURSION_DEPTH = 64;

  readStructBegin(): DpStruct {
    if (++this.recursionDepth > DpTCompactProtocol.MAX_RECURSION_DEPTH) {
      throw new Error('DpTCompactProtocol: max recursion depth exceeded');
    }
    return { name: '' };
  }

  readStructEnd(): void {
    if (--this.recursionDepth < 0) this.recursionDepth = 0;
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

  private static readonly MAX_SAFE_LENGTH = 10 * 1024 * 1024; // 10MB

  private requireSafeLength(len: number): void {
    if (len < 0) throw new Error('DpTCompactProtocol: negative length');
    if (len > DpTCompactProtocol.MAX_SAFE_LENGTH) {
      throw new Error(`DpTCompactProtocol: length ${len} exceeds MAX_SAFE_LENGTH (${DpTCompactProtocol.MAX_SAFE_LENGTH})`);
    }
    if (this.offset + len > this.buffer.byteLength) {
      throw new Error(`DpTCompactProtocol: need ${len} byte(s), have ${this.buffer.byteLength - this.offset}`);
    }
  }

  readString(): string {
    const length = this.readVarint();
    this.requireSafeLength(length);
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  readBinary(): Uint8Array {
    const length = this.readVarint();
    this.requireSafeLength(length);
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
