/**
 * Wire format deserializer
 */

import { SerializationOptions } from '../types/DeukPackTypes';

export class WireDeserializer {
  deserialize<T>(_data: Buffer, targetType: new() => T, _options: SerializationOptions): T {
    return new targetType();
  }
}
