import {
  assertSerializationWireOptions,
  SerializationOptions
} from '../types/DeukPackTypes';
import {
  JsonProtocolDeserializer,
  YamlProtocolDeserializer,
  InteropProtocolDeserializer,
  PackProtocolDeserializer,
  ProtocolDeserializerRegistry
} from './handlers/ProtocolDeserializers';

function toUint8Array(data: Uint8Array | Buffer): Uint8Array {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return data;
}

export class WireDeserializer {
  private static registry = new ProtocolDeserializerRegistry();

  static {
    this.registry.register(new JsonProtocolDeserializer());
    this.registry.register(new YamlProtocolDeserializer());
    this.registry.register(new InteropProtocolDeserializer());
    this.registry.register(new PackProtocolDeserializer());
  }

  deserialize<T>(data: Uint8Array | Buffer, targetType: new () => T, options: SerializationOptions): T {
    assertSerializationWireOptions(options);
    const u8 = toUint8Array(data);
    
    const raw = WireDeserializer.registry.dispatch(u8, options);
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
}
