/**
 * 패키지 진입 `serialize` / `deserialize`용 기본 옵션·공유 인스턴스(비공개 모듈).
 */

import type {
  SerializationOptions,
  WireProtocol,
  WireProtocolFamily
} from '../types/DeukPackTypes';
import { wireProtocolFamily } from '../types/DeukPackTypes';
import { WireDeserializer } from './WireDeserializer';
import { WireSerializer } from './WireSerializer';

export type SerOpts = SerializationOptions & { pretty?: boolean };

let _serializer: WireSerializer | undefined;
let _deserializer: WireDeserializer | undefined;

export function getDefaultWireSerializer(): WireSerializer {
  if (!_serializer) _serializer = new WireSerializer();
  return _serializer;
}

export function getDefaultWireDeserializer(): WireDeserializer {
  if (!_deserializer) _deserializer = new WireDeserializer();
  return _deserializer;
}

/**
 * `protocol` + 덮어쓸 필드로 `SerializationOptions` 구성. `wireFamily` 생략 시 `protocol`에서 추론.
 */
export function createDefaultSerializationOptions(
  protocol: WireProtocol,
  extras?: Partial<Omit<SerializationOptions, 'protocol'>> & { pretty?: boolean }
): SerOpts {
  const e = extras ?? {};
  const wf: WireProtocolFamily = e.wireFamily ?? wireProtocolFamily(protocol);
  const base: SerOpts = {
    protocol,
    wireFamily: wf,
    endianness: e.endianness ?? 'LE',
    optimizeForSize: e.optimizeForSize ?? true,
    includeDefaultValues: e.includeDefaultValues ?? false,
    validateTypes: e.validateTypes ?? false
  };
  if (e.interopRootStruct !== undefined) base.interopRootStruct = e.interopRootStruct;
  if (e.interopStructDefs !== undefined) base.interopStructDefs = e.interopStructDefs;
  if (e.pretty === true) base.pretty = true;
  return base;
}
