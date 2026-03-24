/**
 * BinaryWriter 와 짝을 이루는 리더 (endianness 동일).
 */

import type { Endianness } from './BinaryWriter';

export class BinaryReader {
  private readonly view: Uint8Array;
  private position = 0;
  private readonly endianness: Endianness;

  constructor(data: Uint8Array, endianness: Endianness = 'LE') {
    this.view = data;
    this.endianness = endianness;
  }

  get offset(): number {
    return this.position;
  }

  private require(n: number): void {
    if (this.position + n > this.view.length) {
      throw new Error(`BinaryReader: need ${n} byte(s), have ${this.view.length - this.position}`);
    }
  }

  readByte(): number {
    this.require(1);
    return this.view[this.position++]!;
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readI16(): number {
    this.require(2);
    const v = new DataView(this.view.buffer, this.view.byteOffset + this.position, 2);
    const x = v.getInt16(0, this.endianness === 'LE');
    this.position += 2;
    return x;
  }

  readI32(): number {
    this.require(4);
    const v = new DataView(this.view.buffer, this.view.byteOffset + this.position, 4);
    const x = v.getInt32(0, this.endianness === 'LE');
    this.position += 4;
    return x;
  }

  readI64(): number {
    this.require(8);
    const v = new DataView(this.view.buffer, this.view.byteOffset + this.position, 8);
    const x = v.getBigInt64(0, this.endianness === 'LE');
    this.position += 8;
    return Number(x);
  }

  readDouble(): number {
    this.require(8);
    const v = new DataView(this.view.buffer, this.view.byteOffset + this.position, 8);
    const x = v.getFloat64(0, this.endianness === 'LE');
    this.position += 8;
    return x;
  }

  readString(): string {
    const len = this.readI32();
    if (len < 0) throw new Error('BinaryReader: negative string length');
    this.require(len);
    const slice = this.view.subarray(this.position, this.position + len);
    this.position += len;
    return new TextDecoder('utf-8', { fatal: true }).decode(slice);
  }

  readBinary(): Uint8Array {
    const len = this.readI32();
    if (len < 0) throw new Error('BinaryReader: negative binary length');
    this.require(len);
    const out = this.view.slice(this.position, this.position + len);
    this.position += len;
    return out;
  }
}
