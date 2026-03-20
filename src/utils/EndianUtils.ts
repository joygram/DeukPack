/**
 * DeukPack Endian Utils
 * Endianness utilities
 */

export type Endianness = 'LE' | 'BE';

export class EndianUtils {
  static isLittleEndian(): boolean {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
  }

  static getSystemEndianness(): Endianness {
    return this.isLittleEndian() ? 'LE' : 'BE';
  }

  static swapBytes(buffer: Uint8Array): Uint8Array {
    const result = new Uint8Array(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
      if (i + 1 < buffer.length) {
        result[i] = buffer[i + 1] || 0;
        result[i + 1] = buffer[i] || 0;
      } else {
        result[i] = buffer[i] || 0;
      }
    }
    return result;
  }
}