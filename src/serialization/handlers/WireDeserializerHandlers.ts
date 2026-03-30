import { BinaryReader } from '../../protocols/BinaryReader';
import { SerializationOptions } from '../../types/DeukPackTypes';
import { WireValueTag } from '../wireTags';

export interface IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean;
  handle(reader: BinaryReader, options: SerializationOptions, dispatcher: (r: BinaryReader, d: number) => unknown, depth: number): unknown;
}

export class WireDeserializerRegistry {
  private handlers: Map<WireValueTag, IWireDeserializerHandler> = new Map();
  private static readonly MAX_RECURSION_DEPTH = 64;

  register(tag: WireValueTag, handler: IWireDeserializerHandler): void {
    this.handlers.set(tag, handler);
  }

  dispatch(reader: BinaryReader, options: SerializationOptions, depth: number = 0): unknown {
    if (depth > WireDeserializerRegistry.MAX_RECURSION_DEPTH) {
      throw new Error(`WireDeserializerRegistry: recursion depth limit exceeded (${WireDeserializerRegistry.MAX_RECURSION_DEPTH})`);
    }

    const tag = reader.readByte() as WireValueTag;
    const handler = this.handlers.get(tag);
    if (handler) {
      return handler.handle(reader, options, (r, d) => this.dispatch(r, options, d), depth);
    }
    
    throw new Error(`WireDeserializerRegistry: unknown tag ${tag} at offset ${reader.offset - 1}`);
  }
}
