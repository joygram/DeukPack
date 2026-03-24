/**
 * Thrift Binary protocol (tbinary).
 * Fixed-width fields: type(1B) + id(2B) per field.
 * Endianness configurable (default LE); Apache Thrift binary is BE.
 */

import { DpWireType, type DpProtocol, type DpStruct, type DpField, type DpList, type DpSet, type DpMap } from './WireProtocol';

export class DpTBinaryProtocol implements DpProtocol {
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
