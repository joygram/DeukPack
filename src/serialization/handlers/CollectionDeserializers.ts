import { BinaryReader } from '../../protocols/BinaryReader';
import { WireValueTag } from '../wireTags';
import { IWireDeserializerHandler } from './WireDeserializerHandlers';

export class ArrayDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.Array; }
  handle(reader: BinaryReader, _options: any, dispatcher: (r: BinaryReader, d: number) => unknown, depth: number): unknown {
    const n = reader.readI32();
    if (n < 0) throw new Error('ArrayDeserializer: negative length');
    const arr: unknown[] = [];
    for (let i = 0; i < n; i++) {
      arr.push(dispatcher(reader, depth + 1));
    }
    return arr;
  }
}

export class MapDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.Map; }
  handle(reader: BinaryReader, _options: any, dispatcher: (r: BinaryReader, d: number) => unknown, depth: number): unknown {
    const n = reader.readI32();
    if (n < 0) throw new Error('MapDeserializer: negative size');
    const map = new Map<unknown, unknown>();
    for (let i = 0; i < n; i++) {
      const key = dispatcher(reader, depth + 1);
      const val = dispatcher(reader, depth + 1);
      map.set(key, val);
    }
    return map;
  }
}

export class ObjectDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.Object; }
  handle(reader: BinaryReader, _options: any, dispatcher: (r: BinaryReader, d: number) => unknown, depth: number): unknown {
    const n = reader.readI32();
    if (n < 0) throw new Error('ObjectDeserializer: negative field count');
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < n; i++) {
      const key = reader.readString();
      obj[key] = dispatcher(reader, depth + 1);
    }
    return obj;
  }
}
