import { parse as yamlParse } from 'yaml';
import { SerializationOptions, wireProtocolFamily } from '../../types/DeukPackTypes';
import { BinaryReader } from '../../protocols/BinaryReader';
import { deserializeInteropStruct } from '../interopStructWireCodec';
import { WireDeserializerRegistry } from './WireDeserializerHandlers';
import { WireValueTag } from '../wireTags';
import {
  NullDeserializer,
  BooleanDeserializer,
  NumberDeserializer,
  StringDeserializer,
  BinaryDeserializer
} from './PrimitiveDeserializers';
import {
  ArrayDeserializer,
  MapDeserializer,
  ObjectDeserializer
} from './CollectionDeserializers';

export interface IProtocolDeserializer {
  canHandle(protocol: string, family?: string): boolean;
  deserialize(u8: Uint8Array, options: SerializationOptions): any;
}

export class JsonProtocolDeserializer implements IProtocolDeserializer {
  canHandle(protocol: string): boolean {
    return protocol === 'json';
  }

  deserialize(u8: Uint8Array): any {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(u8));
  }
}

export class YamlProtocolDeserializer implements IProtocolDeserializer {
  canHandle(protocol: string): boolean {
    return protocol === 'yaml';
  }

  deserialize(u8: Uint8Array): any {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(u8);
    return yamlParse(text);
  }
}

export class InteropProtocolDeserializer implements IProtocolDeserializer {
  canHandle(_protocol: string, family?: string): boolean {
    return family === 'interop';
  }

  deserialize(u8: Uint8Array, options: SerializationOptions): any {
    if (!options.interopRootStruct) {
      throw new Error(
        '[DeukPack] Interop wire (tbinary / tcompact / tjson) requires SerializationOptions.interopRootStruct ' +
          'and optional interopStructDefs for nested structs.'
      );
    }
    return deserializeInteropStruct(u8, {
      ...options,
      interopRootStruct: options.interopRootStruct
    });
  }
}

export class PackProtocolDeserializer implements IProtocolDeserializer {
  private static registry = new WireDeserializerRegistry();

  static {
    this.registry.register(WireValueTag.Null, new NullDeserializer());
    this.registry.register(WireValueTag.True, new BooleanDeserializer(true));
    this.registry.register(WireValueTag.False, new BooleanDeserializer(false));
    this.registry.register(WireValueTag.Int32, new NumberDeserializer(WireValueTag.Int32));
    this.registry.register(WireValueTag.Int64, new NumberDeserializer(WireValueTag.Int64));
    this.registry.register(WireValueTag.Double, new NumberDeserializer(WireValueTag.Double));
    this.registry.register(WireValueTag.String, new StringDeserializer());
    this.registry.register(WireValueTag.Binary, new BinaryDeserializer());
    this.registry.register(WireValueTag.Array, new ArrayDeserializer());
    this.registry.register(WireValueTag.Map, new MapDeserializer());
    this.registry.register(WireValueTag.Object, new ObjectDeserializer());
  }

  canHandle(protocol: string): boolean {
    return protocol === 'pack';
  }

  deserialize(u8: Uint8Array, options: SerializationOptions): any {
    const reader = new BinaryReader(u8, options.endianness);
    return PackProtocolDeserializer.registry.dispatch(reader, options);
  }
}

export class ProtocolDeserializerRegistry {
  private handlers: IProtocolDeserializer[] = [];

  register(handler: IProtocolDeserializer): void {
    this.handlers.push(handler);
  }

  dispatch(u8: Uint8Array, options: SerializationOptions): any {
    const family = options.wireFamily ?? wireProtocolFamily(options.protocol);
    for (const handler of this.handlers) {
      if (handler.canHandle(options.protocol, family)) {
        return handler.deserialize(u8, options);
      }
    }
    throw new Error(`[DeukPack] Unsupported protocol "${options.protocol}" for deserialization`);
  }
}
