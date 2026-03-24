/**
 * DeukPack - 100x faster than Apache Thrift
 * Multi-language support: JavaScript, C++, C#
 */

import { getDeukPackPackageVersion } from './deukpackVersion';

export * from './core/DeukPackEngine';
export * from './core/IdlParser';
export * from './core/DeukParser';
export * from './core/ProtoParser';
export * from './core/DeukPackGenerator';
// export * from './protocols/BinaryWriter';
export * from './serialization/WireSerializer';
export * from './serialization/WireDeserializer';
export {
  serializeInteropStruct,
  deserializeInteropStruct,
  canonicalInteropWireProtocol
} from './serialization/interopStructWireCodec';
export * from './codegen/CodeGenerator';
export * from './codegen/cpp';
export * from './codegen/typescript';
export * from './codegen/javascript';
export * from './codegen/CSharpGenerator';
export * from './types/DeukPackTypes';
export * from './protocols/WireProtocol';
export * from './protocols/JsonProtocol';
export * from './protocols/SerializationWarnings';
export { structToPackBinary, structFromPackBinary } from './serialization/packStructWire';
export type { EmbeddedPackSchemaField, EmbeddedPackStructSchema } from './serialization/packStructWire';

// Native bindings
export { NativeDeukPackEngine } from './native/NativeDeukPackEngine';

// Version info (package.json)
export const VERSION = getDeukPackPackageVersion();
export const ENGINE_NAME = 'DeukPack';

// Top-level Serialization API — `serialize(value, protocol, options?)` / `deserialize(data, protocol, options?)`
import type { SerializationOptions, WireProtocol } from './types/DeukPackTypes';
import {
  createDefaultSerializationOptions,
  getDefaultWireDeserializer,
  getDefaultWireSerializer
} from './serialization/wireDefaults';

/** `protocol` 외 옵션: `pretty`(json/yaml), `interopRootStruct`·`interopStructDefs`(tbinary/tcompact/tjson), `endianness` 등. */
export type WireExtras = Partial<Omit<SerializationOptions, 'protocol'>> & { pretty?: boolean };

export type WireDeserializeExtras<T = unknown> = WireExtras & { targetType?: new () => T };

/**
 * 값을 바이트로 직렬화. 기본 프로토콜 `pack`.
 * 인터롭: `serialize(obj, 'tbinary', { interopRootStruct, interopStructDefs? })`
 */
export function serialize(
  value: unknown,
  protocol: WireProtocol = 'pack',
  extras?: WireExtras
): Uint8Array {
  return getDefaultWireSerializer().serialize(
    value,
    createDefaultSerializationOptions(protocol, extras)
  );
}

function toDeserializeInput(data: Uint8Array | Buffer | string): Uint8Array | Buffer {
  if (typeof data === 'string') {
    return typeof Buffer !== 'undefined'
      ? Buffer.from(data, 'utf8')
      : new TextEncoder().encode(data);
  }
  if (typeof Buffer !== 'undefined' && !Buffer.isBuffer(data)) {
    return Buffer.from(data);
  }
  return data;
}

/**
 * 바이트·UTF-8 문자열을 역직렬화. 기본 프로토콜 `pack`.
 * DTO 복원: `deserialize(buf, 'pack', { targetType: MyClass })`
 */
export function deserialize<T = unknown>(
  data: Uint8Array | Buffer | string,
  protocol: WireProtocol = 'pack',
  extras?: WireDeserializeExtras<T>
): T {
  const { targetType, ...rest } = extras ?? {};
  const ctor = (targetType ?? (Object as unknown as new () => object)) as new () => T;
  return getDefaultWireDeserializer().deserialize(
    toDeserializeInput(data),
    ctor,
    createDefaultSerializationOptions(protocol, rest)
  ) as T;
}

export function toString(obj: unknown, pretty = true): string {
  const bytes = serialize(obj, 'json', pretty ? { pretty: true } : {});
  return new TextDecoder().decode(bytes);
}