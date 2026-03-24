/**
 * DeukPack-native wire protocol (pack).
 * Same encoding as Thrift compact (varint tag + varint values) but with a 3-byte magic header
 * (0x44 0x50 0x01) so stored payloads can be identified. Not wire-compatible with Apache Thrift.
 */

import { DpWireType, DP_PACK_MAGIC, type DpProtocol, type DpStruct, type DpField, type DpList, type DpSet, type DpMap } from './WireProtocol';

const DP_PACK_MAGIC_LEN = 3;

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
