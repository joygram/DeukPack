/**
 * Wire format serializer.
 * binary / compact: Thrift-compatible (DpBinaryProtocol, DpCompactProtocol).
 * pack: DeukPack-native (use DpPackProtocol for schema-based; here uses same writer as compact).
 * json: DeukPack JSON wire.
 */

import { SerializationOptions } from '../types/DeukPackTypes';
import { BinaryWriter } from '../protocols/BinaryWriter';

export class WireSerializer {
  serialize<T>(obj: T, options: SerializationOptions): Uint8Array {
    try {
      const startTime = performance.now();
      let writer: BinaryWriter;
      switch (options.protocol) {
        case 'binary':
          writer = new BinaryWriter(options.endianness);
          break;
        case 'compact':
        case 'pack':
          writer = new BinaryWriter(options.endianness);
          break;
        case 'json':
          writer = new BinaryWriter(options.endianness);
          break;
        default:
          throw new Error(`Unsupported protocol: ${options.protocol}`);
      }
      this.serializeValue(obj, writer, options);
      const result = writer.getBuffer();
      const endTime = performance.now();
      console.log(`Serialized in ${endTime - startTime}ms, size: ${result.length} bytes`);
      return result;
    } catch (error) {
      throw new Error(`Serialization failed: ${(error as Error).message}`);
    }
  }

  private serializeValue(value: any, writer: BinaryWriter, options: SerializationOptions): void {
    if (value === null || value === undefined) this.serializeNull(writer);
    else if (typeof value === 'boolean') this.serializeBoolean(value, writer);
    else if (typeof value === 'number') this.serializeNumber(value, writer);
    else if (typeof value === 'string') this.serializeString(value, writer);
    else if (value instanceof Uint8Array) this.serializeBinary(value, writer);
    else if (Array.isArray(value)) this.serializeArray(value, writer, options);
    else if (value instanceof Map) this.serializeMap(value, writer, options);
    else if (typeof value === 'object') this.serializeObject(value, writer, options);
    else throw new Error(`Unsupported type: ${typeof value}`);
  }

  private serializeBoolean(value: boolean, writer: BinaryWriter): void { writer.writeBool(value); }

  private serializeNumber(value: number, writer: BinaryWriter): void {
    if (Number.isInteger(value)) {
      if (value >= -128 && value <= 127) writer.writeByte(value);
      else if (value >= -32768 && value <= 32767) writer.writeI16(value);
      else if (value >= -2147483648 && value <= 2147483647) writer.writeI32(value);
      else writer.writeI64(value);
    } else writer.writeDouble(value);
  }

  private serializeString(value: string, writer: BinaryWriter): void { writer.writeString(value); }

  private serializeBinary(value: Uint8Array, writer: BinaryWriter): void { writer.writeBinary(value); }

  private serializeArray(value: any[], writer: BinaryWriter, options: SerializationOptions): void {
    writer.writeI32(value.length);
    for (const item of value) this.serializeValue(item, writer, options);
  }

  private serializeMap(value: Map<any, any>, writer: BinaryWriter, options: SerializationOptions): void {
    writer.writeI32(value.size);
    for (const [key, val] of value) {
      this.serializeValue(key, writer, options);
      this.serializeValue(val, writer, options);
    }
  }

  private serializeObject(value: any, writer: BinaryWriter, options: SerializationOptions): void {
    const keys = Object.keys(value);
    writer.writeI32(keys.length);
    for (const key of keys) {
      this.serializeString(key, writer);
      this.serializeValue(value[key], writer, options);
    }
  }

  private serializeNull(writer: BinaryWriter): void { writer.writeByte(0); }
}
