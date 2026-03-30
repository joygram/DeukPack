import { BinaryReader } from '../../protocols/BinaryReader';
import { WireValueTag } from '../wireTags';
import { IWireDeserializerHandler } from './WireDeserializerHandlers';

export class NullDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.Null; }
  handle(): unknown { return null; }
}

export class BooleanDeserializer implements IWireDeserializerHandler {
  constructor(private readonly value: boolean) {}
  canHandle(tag: WireValueTag): boolean {
    return this.value ? tag === WireValueTag.True : tag === WireValueTag.False;
  }
  handle(): unknown { return this.value; }
}

export class NumberDeserializer implements IWireDeserializerHandler {
  constructor(private readonly tagMatch: WireValueTag) {}
  canHandle(tag: WireValueTag): boolean { return tag === this.tagMatch; }
  handle(reader: BinaryReader): unknown {
    switch (this.tagMatch) {
      case WireValueTag.Int32: return reader.readI32();
      case WireValueTag.Int64: return reader.readI64();
      case WireValueTag.Double: return reader.readDouble();
      default: throw new Error(`NumberDeserializer: unexpected tag ${this.tagMatch}`);
    }
  }
}

export class StringDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.String; }
  handle(reader: BinaryReader): unknown { return reader.readString(); }
}

export class BinaryDeserializer implements IWireDeserializerHandler {
  canHandle(tag: WireValueTag): boolean { return tag === WireValueTag.Binary; }
  handle(reader: BinaryReader): unknown { return reader.readBinary(); }
}
