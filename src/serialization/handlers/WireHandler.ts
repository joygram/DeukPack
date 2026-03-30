import { BinaryWriter } from '../../protocols/BinaryWriter';
import { SerializationOptions } from '../../types/DeukPackTypes';

export interface IWireHandler {
  canHandle(value: unknown): boolean;
  handle(value: unknown, writer: BinaryWriter, options: SerializationOptions, dispatcher: (v: unknown) => void): void;
}

export class WireHandlerRegistry {
  private handlers: IWireHandler[] = [];

  register(handler: IWireHandler): void {
    this.handlers.push(handler);
  }

  dispatch(value: unknown, writer: BinaryWriter, options: SerializationOptions): void {
    for (const handler of this.handlers) {
      if (handler.canHandle(value)) {
        handler.handle(value, writer, options, (v) => this.dispatch(v, writer, options));
        return;
      }
    }
    throw new Error(`[DeukPack] Unsupported type for serialization: ${typeof value}`);
  }
}
