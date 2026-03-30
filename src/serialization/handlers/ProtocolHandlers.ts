import { stringify as yamlStringify } from 'yaml';
import { SerializationOptions, wireProtocolFamily } from '../../types/DeukPackTypes';
import { BinaryWriter } from '../../protocols/BinaryWriter';
import { serializeInteropStruct } from '../interopStructWireCodec';
import { WireHandlerRegistry } from './WireHandler';
import {
  NullHandler,
  BooleanHandler,
  NumberHandler,
  StringHandler,
  BinaryHandler
} from './PrimitiveHandlers';
import {
  ArrayHandler,
  MapHandler,
  ObjectHandler
} from './CollectionHandlers';

export interface IProtocolHandler {
  canHandle(protocol: string, family?: string): boolean;
  serialize(obj: any, options: SerializationOptions): Uint8Array;
}

export class JsonProtocolHandler implements IProtocolHandler {
  canHandle(protocol: string): boolean {
    return protocol === 'json';
  }

  serialize(obj: any, options: SerializationOptions): Uint8Array {
    const pretty = (options as any).pretty === true;
    return new TextEncoder().encode(JSON.stringify(obj, null, pretty ? 2 : undefined));
  }
}

export class YamlProtocolHandler implements IProtocolHandler {
  canHandle(protocol: string): boolean {
    return protocol === 'yaml';
  }

  serialize(obj: any, options: SerializationOptions): Uint8Array {
    const pretty = (options as any).pretty === true;
    const text = yamlStringify(obj, {
      indent: pretty ? 2 : 0,
      lineWidth: 0
    });
    return new TextEncoder().encode(text);
  }
}

export class InteropProtocolHandler implements IProtocolHandler {
  canHandle(_protocol: string, family?: string): boolean {
    return family === 'interop';
  }

  serialize(obj: any, options: SerializationOptions): Uint8Array {
    if (!options.interopRootStruct) {
      throw new Error(
        '[DeukPack] Interop wire (tbinary / tcompact / tjson) requires SerializationOptions.interopRootStruct ' +
          'and optional interopStructDefs for nested structs.'
      );
    }
    return serializeInteropStruct(obj as Record<string, unknown>, {
      ...options,
      interopRootStruct: options.interopRootStruct
    });
  }
}

export class PackProtocolHandler implements IProtocolHandler {
  private static registry = new WireHandlerRegistry();

  static {
    this.registry.register(new NullHandler());
    this.registry.register(new BooleanHandler());
    this.registry.register(new NumberHandler());
    this.registry.register(new StringHandler());
    this.registry.register(new BinaryHandler());
    this.registry.register(new ArrayHandler());
    this.registry.register(new MapHandler());
    this.registry.register(new ObjectHandler());
  }

  canHandle(protocol: string): boolean {
    return protocol === 'pack';
  }

  serialize(obj: any, options: SerializationOptions): Uint8Array {
    const writer = new BinaryWriter(options.endianness);
    PackProtocolHandler.registry.dispatch(obj, writer, options);
    return writer.getBuffer();
  }
}

export class ProtocolHandlerRegistry {
  private handlers: IProtocolHandler[] = [];

  register(handler: IProtocolHandler): void {
    this.handlers.push(handler);
  }

  dispatch(obj: any, options: SerializationOptions): Uint8Array {
    const family = options.wireFamily ?? wireProtocolFamily(options.protocol);
    for (const handler of this.handlers) {
      if (handler.canHandle(options.protocol, family)) {
        return handler.serialize(obj, options);
      }
    }
    throw new Error(`[DeukPack] Unsupported protocol "${options.protocol}"`);
  }
}
