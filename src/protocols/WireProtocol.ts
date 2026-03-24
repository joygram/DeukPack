/**
 * DeukPack Wire Protocol — 공유 인터페이스·타입·엔벨로프·프로토콜 감지.
 * 구현체는 계열별 파일:
 *   TBinaryProtocol.ts  — DpTBinaryProtocol  (Thrift Binary)
 *   TCompactProtocol.ts — DpTCompactProtocol (Thrift Compact)
 *   JsonProtocol.ts     — DpTJsonProtocol    (Thrift JSON)
 *   PackProtocol.ts     — DpPackProtocol  (득팩 전용)
 *   ZeroCopyProtocol.ts — DpZeroCopyProtocol (득팩 전용, 버퍼 복사 없이 뷰 반환)
 *   ProtobufProtocol.ts — DpProtobufProtocol (Google Protobuf v2/v3)
 * 하위 호환을 위해 모든 클래스를 re-export 한다.
 */

// ── 공유 타입 ──

export enum DpWireType {
  Stop = 0,
  Void = 1,
  Bool = 2,
  Byte = 3,
  Double = 4,
  Int16 = 6,
  Int32 = 8,
  Int64 = 10,
  String = 11,
  Struct = 12,
  Map = 13,
  Set = 14,
  List = 15
}

export enum DpMessageType {
  Call = 1,
  Reply = 2,
  Exception = 3,
  Oneway = 4
}

export interface DpStruct {
  name: string;
}

export interface DpField {
  name: string;
  type: DpWireType;
  id: number;
}

export interface DpList {
  elementType: DpWireType;
  count: number;
}

export interface DpSet {
  elementType: DpWireType;
  count: number;
}

export interface DpMap {
  keyType: DpWireType;
  valueType: DpWireType;
  count: number;
}

export interface DpProtocol {
  writeStructBegin(struct: DpStruct): void;
  writeStructEnd(): void;
  writeFieldBegin(field: DpField): void;
  writeFieldEnd(): void;
  writeFieldStop(): void;
  writeBool(value: boolean): void;
  writeByte(value: number): void;
  writeI16(value: number): void;
  writeI32(value: number): void;
  writeI64(value: bigint): void;
  writeDouble(value: number): void;
  writeString(value: string): void;
  writeBinary(value: Uint8Array): void;
  writeListBegin(list: DpList): void;
  writeListEnd(): void;
  writeSetBegin(set: DpSet): void;
  writeSetEnd(): void;
  writeMapBegin(map: DpMap): void;
  writeMapEnd(): void;

  readStructBegin(): DpStruct;
  readStructEnd(): void;
  readFieldBegin(): DpField;
  readFieldEnd(): void;
  readBool(): boolean;
  readByte(): number;
  readI16(): number;
  readI32(): number;
  readI64(): bigint;
  readDouble(): number;
  readString(): string;
  readBinary(): Uint8Array;
  readListBegin(): DpList;
  readListEnd(): void;
  readSetBegin(): DpSet;
  readSetEnd(): void;
  readMapBegin(): DpMap;
  readMapEnd(): void;
}

// ── 엔벨로프·매직 ──

/** Magic header for DpPack wire (3 bytes): 'DP' + version 1. */
export const DP_PACK_MAGIC = new Uint8Array([0x44, 0x50, 0x01]);
const DP_PACK_MAGIC_LEN = 3;

/** Envelope: [0x44, 0x50, version, protocol_id]. */
export const DP_WIRE_ENVELOPE_SIZE = 4;
export const DP_WIRE_ENVELOPE_MAGIC0 = 0x44;
export const DP_WIRE_ENVELOPE_MAGIC1 = 0x50;

/** Protocol id in envelope. */
export const DP_WIRE_PROTOCOL_BINARY = 0;
export const DP_WIRE_PROTOCOL_COMPACT = 1;
export const DP_WIRE_PROTOCOL_PACK = 2;
export const DP_WIRE_PROTOCOL_ZEROCOPY = 3;
export const DP_WIRE_PROTOCOL_PROTOBUF = 4;

export type DpWireProtocolName = 'binary' | 'compact' | 'pack' | 'zerocopy' | 'protobuf';

const ENVELOPE_PROTOCOL_TO_ID: Record<DpWireProtocolName, number> = {
  binary: DP_WIRE_PROTOCOL_BINARY,
  compact: DP_WIRE_PROTOCOL_COMPACT,
  pack: DP_WIRE_PROTOCOL_PACK,
  zerocopy: DP_WIRE_PROTOCOL_ZEROCOPY,
  protobuf: DP_WIRE_PROTOCOL_PROTOBUF
};

const ENVELOPE_ID_TO_PROTOCOL: Record<number, DpWireProtocolName> = {
  [DP_WIRE_PROTOCOL_BINARY]: 'binary',
  [DP_WIRE_PROTOCOL_COMPACT]: 'compact',
  [DP_WIRE_PROTOCOL_PACK]: 'pack',
  [DP_WIRE_PROTOCOL_ZEROCOPY]: 'zerocopy',
  [DP_WIRE_PROTOCOL_PROTOBUF]: 'protobuf'
};

export function writeEnvelope(
  buffer: ArrayBuffer,
  protocol: DpWireProtocolName,
  version: number = 1
): void {
  const u8 = new Uint8Array(buffer, 0, DP_WIRE_ENVELOPE_SIZE);
  u8[0] = DP_WIRE_ENVELOPE_MAGIC0;
  u8[1] = DP_WIRE_ENVELOPE_MAGIC1;
  u8[2] = version & 0xff;
  u8[3] = ENVELOPE_PROTOCOL_TO_ID[protocol];
}

export function readEnvelope(
  buffer: ArrayBuffer | Uint8Array
): { version: number; protocol: DpWireProtocolName } | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < DP_WIRE_ENVELOPE_SIZE ||
      bytes[0] !== DP_WIRE_ENVELOPE_MAGIC0 ||
      bytes[1] !== DP_WIRE_ENVELOPE_MAGIC1) {
    return null;
  }
  const version = (bytes[2] ?? 0) & 0xff;
  const id = (bytes[3] ?? 0) & 0xff;
  const protocol = ENVELOPE_ID_TO_PROTOCOL[id];
  if (protocol === undefined) return null;
  return { version, protocol };
}

// ── 계열별 구현 re-export ──

// Thrift 호환 (T prefix)
export { DpTBinaryProtocol } from './TBinaryProtocol';
export { DpTCompactProtocol } from './TCompactProtocol';
// 득팩 전용
export { DpPackProtocol } from './PackProtocol';
export { DpZeroCopyProtocol } from './ZeroCopyProtocol';
// Protobuf
export { DpProtobufProtocol } from './ProtobufProtocol';

// 하위 호환 alias — 기존 `DpBinaryProtocol` 등으로 import 하던 코드가 깨지지 않도록
import { DpTBinaryProtocol } from './TBinaryProtocol';
import { DpTCompactProtocol } from './TCompactProtocol';
import { DpPackProtocol } from './PackProtocol';
import { DpZeroCopyProtocol } from './ZeroCopyProtocol';
import { DpProtobufProtocol } from './ProtobufProtocol';

/** @deprecated Use DpTBinaryProtocol */
export const DpBinaryProtocol = DpTBinaryProtocol;
/** @deprecated Use DpTCompactProtocol */
export const DpCompactProtocol = DpTCompactProtocol;
/** @deprecated type alias */
export type DpBinaryProtocol = DpTBinaryProtocol;
/** @deprecated type alias */
export type DpCompactProtocol = DpTCompactProtocol;

export function detectWireProtocol(buffer: ArrayBuffer | Uint8Array): DpWireProtocolName | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const env = readEnvelope(bytes);
  if (env) return env.protocol;
  if (bytes.length >= DP_PACK_MAGIC_LEN &&
      bytes[0] === DP_PACK_MAGIC[0] &&
      bytes[1] === DP_PACK_MAGIC[1] &&
      bytes[2] === DP_PACK_MAGIC[2]) {
    return 'pack';
  }
  return 'binary';
}

export function createProtocolForUnpack(
  buffer: ArrayBuffer,
  littleEndian: boolean = true
): { protocol: DpTBinaryProtocol | DpTCompactProtocol | DpPackProtocol | DpZeroCopyProtocol | DpProtobufProtocol; bodyOffset: number } {
  const env = readEnvelope(buffer);
  if (env) {
    if (env.protocol === 'protobuf') {
      const proto = new DpProtobufProtocol(buffer.slice(DP_WIRE_ENVELOPE_SIZE));
      return { protocol: proto, bodyOffset: DP_WIRE_ENVELOPE_SIZE };
    }
    const proto =
      env.protocol === 'binary' ? new DpTBinaryProtocol(buffer, littleEndian)
      : env.protocol === 'compact' ? new DpTCompactProtocol(buffer, littleEndian)
      : env.protocol === 'zerocopy' ? new DpZeroCopyProtocol(buffer, littleEndian)
      : new DpPackProtocol(buffer, littleEndian);
    proto.setOffset(DP_WIRE_ENVELOPE_SIZE);
    return { protocol: proto, bodyOffset: DP_WIRE_ENVELOPE_SIZE };
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= DP_PACK_MAGIC_LEN &&
      bytes[0] === DP_PACK_MAGIC[0] &&
      bytes[1] === DP_PACK_MAGIC[1] &&
      bytes[2] === DP_PACK_MAGIC[2]) {
    const proto = new DpPackProtocol(buffer, littleEndian);
    proto.setOffset(DP_PACK_MAGIC_LEN);
    return { protocol: proto, bodyOffset: DP_PACK_MAGIC_LEN };
  }
  const proto = new DpTBinaryProtocol(buffer, littleEndian);
  return { protocol: proto, bodyOffset: 0 };
}
