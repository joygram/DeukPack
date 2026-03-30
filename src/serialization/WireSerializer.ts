import {
  assertSerializationWireOptions,
  SerializationOptions
} from '../types/DeukPackTypes';
import {
  ProtocolHandlerRegistry,
  JsonProtocolHandler,
  YamlProtocolHandler,
  InteropProtocolHandler,
  PackProtocolHandler
} from './handlers/ProtocolHandlers';

export class WireSerializer {
  private static protocolRegistry = new ProtocolHandlerRegistry();

  static {
    this.protocolRegistry.register(new JsonProtocolHandler());
    this.protocolRegistry.register(new YamlProtocolHandler());
    this.protocolRegistry.register(new InteropProtocolHandler());
    this.protocolRegistry.register(new PackProtocolHandler());
  }

  serialize<T>(obj: T, options: SerializationOptions): Uint8Array {
    try {
      assertSerializationWireOptions(options);
      return WireSerializer.protocolRegistry.dispatch(obj, options);
    } catch (error) {
      throw new Error(`Serialization failed: ${(error as Error).message}`);
    }
  }
}
