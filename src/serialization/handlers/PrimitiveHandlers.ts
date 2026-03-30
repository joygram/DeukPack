import { BinaryWriter } from '../../protocols/BinaryWriter';
import { SerializationOptions } from '../../types/DeukPackTypes';
import { WireValueTag } from '../wireTags';
import { IWireHandler } from './WireHandler';

export class NullHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return value === null || value === undefined; }
  handle(_value: unknown, writer: BinaryWriter, _options: SerializationOptions, _dispatcher: (v: unknown) => void): void {
    writer.writeByte(WireValueTag.Null);
  }
}

export class BooleanHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return typeof value === 'boolean'; }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, _dispatcher: (v: unknown) => void): void {
    writer.writeByte(value ? WireValueTag.True : WireValueTag.False);
  }
}

export class NumberHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return typeof value === 'number'; }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, _dispatcher: (v: unknown) => void): void {
    const num = value as number;
    if (!Number.isFinite(num)) {
      writer.writeByte(WireValueTag.Double);
      writer.writeDouble(num);
      return;
    }
    if (Number.isInteger(num) && num >= -0x80000000 && num <= 0x7fffffff) {
      writer.writeByte(WireValueTag.Int32);
      writer.writeI32(num);
      return;
    }
    if (Number.isInteger(num)) {
      writer.writeByte(WireValueTag.Int64);
      writer.writeI64(num);
      return;
    }
    writer.writeByte(WireValueTag.Double);
    writer.writeDouble(num);
  }
}

export class StringHandler implements IWireHandler {
  canHandle(value: unknown): boolean { return typeof value === 'string'; }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, _dispatcher: (v: unknown) => void): void {
    writer.writeByte(WireValueTag.String);
    writer.writeString(value as string);
  }
}

export class BinaryHandler implements IWireHandler {
  canHandle(value: unknown): boolean {
    return value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value));
  }
  handle(value: unknown, writer: BinaryWriter, _options: SerializationOptions, _dispatcher: (v: unknown) => void): void {
    writer.writeByte(WireValueTag.Binary);
    writer.writeBinary(value as Uint8Array);
  }
}
