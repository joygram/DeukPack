/**
 * 교차 검증: Google Protobuf 참조 구현(protobufjs) ↔ DeukPack `protv3` 와이어.
 */
import * as protobuf from 'protobufjs';

import type { DeukPackStruct } from '../../types/DeukPackTypes';
import { deserialize, serialize } from '../../index';

const boxProto = `syntax = "proto3";
message Box {
  int32 n = 1;
  string s = 2;
}
`;

const flagsProto = `syntax = "proto3";
message Flags {
  bool b = 1;
}
`;

const boxRoot = protobuf.parse(boxProto).root;
const Box = boxRoot.lookupType('Box');

const flagsRoot = protobuf.parse(flagsProto).root;
const Flags = flagsRoot.lookupType('Flags');

const boxStruct: DeukPackStruct = {
  name: 'Box',
  fields: [
    { id: 1, name: 'n', type: 'int32', required: true },
    { id: 2, name: 's', type: 'string', required: false }
  ]
};

const flagsStruct: DeukPackStruct = {
  name: 'Flags',
  fields: [{ id: 1, name: 'b', type: 'bool', required: true }]
};

describe('protv3 vs protobufjs (Google wire)', () => {
  test('protobufjs encode → DeukPack decode', () => {
    const payload = { n: 7, s: 'hi' };
    const err = Box.verify(payload);
    expect(err).toBeNull();
    const pbBytes = Box.encode(Box.create(payload)).finish();
    const deuk = deserialize<Record<string, unknown>>(pbBytes, 'protv3', { interopRootStruct: boxStruct });
    expect(deuk).toEqual({ n: 7, s: 'hi' });
  });

  test('DeukPack encode → protobufjs decode', () => {
    const payload = { n: -42, s: 'proto' };
    const deukBytes = serialize(payload, 'protv3', { interopRootStruct: boxStruct });
    const msg = Box.decode(deukBytes);
    const obj = Box.toObject(msg, { defaults: true });
    expect(obj).toMatchObject({ n: -42, s: 'proto' });
  });

  test('bytes match for scalar message (deterministic field order)', () => {
    const payload = { n: 1, s: 'a' };
    const pbBytes = Uint8Array.from(Box.encode(Box.create(payload)).finish());
    const deukBytes = serialize(payload, 'protv3', { interopRootStruct: boxStruct });
    expect(Buffer.from(deukBytes).equals(Buffer.from(pbBytes))).toBe(true);
  });

  test('bool varint: protobufjs ↔ DeukPack bytes and decode', () => {
    const pbBytes = Uint8Array.from(Flags.encode(Flags.create({ b: true })).finish());
    const deuk = deserialize<Record<string, unknown>>(pbBytes, 'protv3', { interopRootStruct: flagsStruct });
    expect(deuk).toEqual({ b: true });

    const deukBytes = serialize({ b: true }, 'protv3', { interopRootStruct: flagsStruct });
    const msg = Flags.decode(deukBytes);
    expect(Flags.toObject(msg, { defaults: true })).toMatchObject({ b: true });
    expect(Buffer.from(deukBytes).equals(Buffer.from(pbBytes))).toBe(true);
  });
});
