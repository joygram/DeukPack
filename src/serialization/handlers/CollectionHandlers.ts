import { BinaryWriter } from '../../protocols/BinaryWriter';
import { SerializationOptions } from '../../types/DeukPackTypes';
import { WireValueTag } from '../wireTags';
import { IWireHandler } from './WireHandler';

export class ArrayHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return Array.isArray(value); }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, dispatcher: (v: unknown) => void): void {
    const list = value as unknown[];
    writer.writeByte(WireValueTag.Array);
    writer.writeI32(list.length);
    for (const item of list) dispatcher(item);
  }
}

export class MapHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return value instanceof Map; }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, dispatcher: (v: unknown) => void): void {
    const map = value as Map<unknown, unknown>;
    writer.writeByte(WireValueTag.Map);
    writer.writeI32(map.size);
    for (const [key, val] of map) {
      dispatcher(key);
      dispatcher(val);
    }
  }
}

export class ObjectHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return value !== null && typeof value === 'object'; }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, dispatcher: (v: unknown) => void): void {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    writer.writeByte(WireValueTag.Object);
    writer.writeI32(keys.length);
    for (const key of keys) {
      writer.writeString(key);
      dispatcher(obj[key]);
    }
  }
}
