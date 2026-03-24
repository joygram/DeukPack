/**
 * Wire format deserializer (`WireSerializer` 의 pack/json/yaml 및 스키마 기반 tbinary/tcompact/tjson 과 짝).
 */

import { parse as yamlParse } from 'yaml';
import {
  assertSerializationWireOptions,
  SerializationOptions,
  wireProtocolFamily
} from '../types/DeukPackTypes';
import { BinaryReader } from '../protocols/BinaryReader';
import { deserializeInteropStruct } from './interopStructWireCodec';
import { WireValueTag } from './wireTags';

function toUint8Array(data: Uint8Array | Buffer): Uint8Array {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return data;
}

export class WireDeserializer {
  deserialize<T>(data: Uint8Array | Buffer, targetType: new () => T, options: SerializationOptions): T {
    assertSerializationWireOptions(options);
    const u8 = toUint8Array(data);
    const family = options.wireFamily ?? wireProtocolFamily(options.protocol);
    if (family === 'interop') {
      if (!options.interopRootStruct) {
        throw new Error(
          '[DeukPack] Interop wire (tbinary / tcompact / tjson) requires SerializationOptions.interopRootStruct ' +
            'and optional interopStructDefs for nested structs. Deuk native: protocol "pack", "json", or "yaml".'
        );
      }
      const raw = deserializeInteropStruct(u8, {
        ...options,
        interopRootStruct: options.interopRootStruct
      });
      return this.wrapTarget(raw, targetType) as T;
    }
    let raw: unknown;
    if (options.protocol === 'json') {
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(u8)) as unknown;
    } else if (options.protocol === 'yaml') {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(u8);
      raw = yamlParse(text) as unknown;
    } else if (options.protocol === 'pack') {
      const reader = new BinaryReader(u8, options.endianness);
      raw = this.deserializeValue(reader, options);
    } else {
      throw new Error(`[DeukPack] Unexpected deuk protocol "${options.protocol}"`);
    }
    return this.wrapTarget(raw, targetType) as T;
  }

  private wrapTarget<T>(raw: unknown, targetType: new () => T): unknown {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw) || raw instanceof Map || raw instanceof Uint8Array) {
      return raw;
    }
    try {
      return Object.assign(new targetType() as object, raw as object);
    } catch {
      return raw;
    }
  }

  private deserializeValue(reader: BinaryReader, _options: SerializationOptions): unknown {
    void _options;
    const tag = reader.readByte() as WireValueTag;
    switch (tag) {
      case WireValueTag.Null:
        return null;
      case WireValueTag.False:
        return false;
      case WireValueTag.True:
        return true;
      case WireValueTag.Int32:
        return reader.readI32();
      case WireValueTag.Int64:
        return reader.readI64();
      case WireValueTag.Double:
        return reader.readDouble();
      case WireValueTag.String:
        return reader.readString();
      case WireValueTag.Binary:
        return reader.readBinary();
      case WireValueTag.Array: {
        const n = reader.readI32();
        if (n < 0) throw new Error('WireDeserializer: negative array length');
        const arr: unknown[] = [];
        for (let i = 0; i < n; i++) arr.push(this.deserializeValue(reader, _options));
        return arr;
      }
      case WireValueTag.Map: {
        const n = reader.readI32();
        if (n < 0) throw new Error('WireDeserializer: negative map size');
        const map = new Map<unknown, unknown>();
        for (let i = 0; i < n; i++) {
          const key = this.deserializeValue(reader, _options);
          const val = this.deserializeValue(reader, _options);
          map.set(key, val);
        }
        return map;
      }
      case WireValueTag.Object: {
        const n = reader.readI32();
        if (n < 0) throw new Error('WireDeserializer: negative object field count');
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const key = reader.readString();
          obj[key] = this.deserializeValue(reader, _options);
        }
        return obj;
      }
      default:
        throw new Error(`WireDeserializer: unknown tag ${tag}`);
    }
  }
}
