/**
 * Wire format serializer.
 * pack: 태그 + BinaryWriter; json/yaml: UTF-8 텍스트.
 * tbinary/tcompact/tjson: `interopRootStruct`(+ `interopStructDefs`)와 함께 Thrift 호환(`interopStructWireCodec`).
 */

import { stringify as yamlStringify } from 'yaml';
import {
  assertSerializationWireOptions,
  SerializationOptions,
  wireProtocolFamily
} from '../types/DeukPackTypes';
import { BinaryWriter } from '../protocols/BinaryWriter';
import { serializeInteropStruct } from './interopStructWireCodec';
import { WireValueTag } from './wireTags';

type SerOpts = SerializationOptions & { pretty?: boolean };

export class WireSerializer {
  serialize<T>(obj: T, options: SerializationOptions): Uint8Array {
    try {
      assertSerializationWireOptions(options);
      const family = options.wireFamily ?? wireProtocolFamily(options.protocol);
      if (family === 'interop') {
        if (!options.interopRootStruct) {
          throw new Error(
            '[DeukPack] Interop wire (tbinary / tcompact / tjson) requires SerializationOptions.interopRootStruct ' +
              'and optional interopStructDefs for nested structs. Deuk native without schema: protocol "pack", "json", or "yaml".'
          );
        }
        return serializeInteropStruct(obj as Record<string, unknown>, {
          ...options,
          interopRootStruct: options.interopRootStruct
        });
      }
      if (options.protocol === 'json') {
        const pretty = (options as SerOpts).pretty === true;
        return new TextEncoder().encode(JSON.stringify(obj, null, pretty ? 2 : undefined));
      }
      if (options.protocol === 'yaml') {
        const pretty = (options as SerOpts).pretty === true;
        const text = yamlStringify(obj, {
          indent: pretty ? 2 : 0,
          lineWidth: 0
        });
        return new TextEncoder().encode(text);
      }
      if (options.protocol !== 'pack') {
        throw new Error(`[DeukPack] Unexpected deuk protocol "${options.protocol}"`);
      }
      const writer = new BinaryWriter(options.endianness);
      this.serializeValue(obj, writer, options);
      return writer.getBuffer();
    } catch (error) {
      throw new Error(`Serialization failed: ${(error as Error).message}`);
    }
  }

  private serializeValue(value: unknown, writer: BinaryWriter, _options: SerializationOptions): void {
    void _options;
    if (value === null || value === undefined) {
      writer.writeByte(WireValueTag.Null);
      return;
    }
    if (typeof value === 'boolean') {
      writer.writeByte(value ? WireValueTag.True : WireValueTag.False);
      return;
    }
    if (typeof value === 'number') {
      this.serializeNumber(value, writer);
      return;
    }
    if (typeof value === 'string') {
      writer.writeByte(WireValueTag.String);
      writer.writeString(value);
      return;
    }
    if (value instanceof Uint8Array) {
      writer.writeByte(WireValueTag.Binary);
      writer.writeBinary(value);
      return;
    }
    if (Array.isArray(value)) {
      writer.writeByte(WireValueTag.Array);
      writer.writeI32(value.length);
      for (const item of value) this.serializeValue(item, writer, _options);
      return;
    }
    if (value instanceof Map) {
      writer.writeByte(WireValueTag.Map);
      writer.writeI32(value.size);
      for (const [key, val] of value) {
        this.serializeValue(key, writer, _options);
        this.serializeValue(val, writer, _options);
      }
      return;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value as object);
      writer.writeByte(WireValueTag.Object);
      writer.writeI32(keys.length);
      for (const key of keys) {
        writer.writeString(key);
        this.serializeValue((value as Record<string, unknown>)[key], writer, _options);
      }
      return;
    }
    throw new Error(`Unsupported type: ${typeof value}`);
  }

  private serializeNumber(value: number, writer: BinaryWriter): void {
    if (!Number.isFinite(value)) {
      writer.writeByte(WireValueTag.Double);
      writer.writeDouble(value);
      return;
    }
    if (Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff) {
      writer.writeByte(WireValueTag.Int32);
      writer.writeI32(value);
      return;
    }
    if (Number.isInteger(value)) {
      writer.writeByte(WireValueTag.Int64);
      writer.writeI64(value);
      return;
    }
    writer.writeByte(WireValueTag.Double);
    writer.writeDouble(value);
  }
}
