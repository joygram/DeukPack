/**
 * DeukPack Binary Writer
 * High-performance binary serialization
 */

export type Endianness = 'LE' | 'BE';

export class BinaryWriter {
  private buffer: Uint8Array;
  private position: number = 0;
  private endianness: Endianness;

  constructor(endianness: Endianness = 'LE', initialSize: number = 1024) {
    this.endianness = endianness;
    this.buffer = new Uint8Array(initialSize);
  }

  private ensureCapacity(bytesNeeded: number): void {
    if (this.position + bytesNeeded > this.buffer.length) {
      let newSize = this.buffer.length * 2;
      while (this.position + bytesNeeded > newSize) {
        newSize *= 2;
      }
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
    }
  }

  writeByte(value: number): void {
    this.ensureCapacity(1);
    this.buffer[this.position++] = value;
  }

  writeBool(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }

  writeI16(value: number): void {
    this.ensureCapacity(2);
    if (this.endianness === 'LE') {
      this.buffer[this.position] = value & 0xFF;
      this.buffer[this.position + 1] = (value >> 8) & 0xFF;
    } else {
      this.buffer[this.position] = (value >> 8) & 0xFF;
      this.buffer[this.position + 1] = value & 0xFF;
    }
    this.position += 2;
  }

  writeI32(value: number): void {
    this.ensureCapacity(4);
    if (this.endianness === 'LE') {
      this.buffer[this.position] = value & 0xFF;
      this.buffer[this.position + 1] = (value >> 8) & 0xFF;
      this.buffer[this.position + 2] = (value >> 16) & 0xFF;
      this.buffer[this.position + 3] = (value >> 24) & 0xFF;
    } else {
      this.buffer[this.position] = (value >> 24) & 0xFF;
      this.buffer[this.position + 1] = (value >> 16) & 0xFF;
      this.buffer[this.position + 2] = (value >> 8) & 0xFF;
      this.buffer[this.position + 3] = value & 0xFF;
    }
    this.position += 4;
  }

  writeI64(value: number): void {
    this.ensureCapacity(8);
    if (this.endianness === 'LE') {
      for (let i = 0; i < 8; i++) {
        this.buffer[this.position + i] = (value >> (i * 8)) & 0xFF;
      }
    } else {
      for (let i = 0; i < 8; i++) {
        this.buffer[this.position + i] = (value >> ((7 - i) * 8)) & 0xFF;
      }
    }
    this.position += 8;
  }

  writeDouble(value: number): void {
    this.ensureCapacity(8);
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.position, 8);
    if (this.endianness === 'LE') {
      view.setFloat64(0, value, true);
    } else {
      view.setFloat64(0, value, false);
    }
    this.position += 8;
  }

  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeI32(bytes.length);
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.position);
    this.position += bytes.length;
  }

  writeBinary(value: Uint8Array): void {
    this.writeI32(value.length);
    this.ensureCapacity(value.length);
    this.buffer.set(value, this.position);
    this.position += value.length;
  }

  getBuffer(): Uint8Array {
    return this.buffer.slice(0, this.position);
  }
}