import type { DeukPackStruct } from '../../types/DeukPackTypes';
import { deserialize, serialize } from '../../index';

describe('serialize / deserialize (protocol + options)', () => {
  test('pack roundtrip', () => {
    const o = { a: 1, b: 'x' };
    const u8 = serialize(o, 'pack');
    const back = deserialize<typeof o>(u8, 'pack');
    expect(back).toEqual(o);
  });

  test('json pretty + string input', () => {
    const o = { k: [1, 2] };
    const u8 = serialize(o, 'json', { pretty: true });
    const back = deserialize<typeof o>(u8, 'json');
    expect(back).toEqual(o);
    const text = new TextDecoder().decode(u8);
    expect(deserialize<typeof o>(text, 'json')).toEqual(o);
  });

  test('yaml roundtrip + pretty', () => {
    const o = { a: 1, b: 'y' };
    const u8 = serialize(o, 'yaml', { pretty: true });
    expect(deserialize<typeof o>(u8, 'yaml')).toEqual(o);
  });

  test('deserialize accepts Buffer when available', () => {
    if (typeof Buffer === 'undefined') return;
    const o = { q: 3 };
    const u8 = serialize(o, 'pack');
    const back = deserialize<typeof o>(Buffer.from(u8), 'pack');
    expect(back).toEqual(o);
  });

  test('explicit options match pack default', () => {
    const o = { n: 42 };
    const a = serialize(o, 'pack');
    const b = serialize(o, 'pack', {
      wireFamily: 'deuk',
      endianness: 'LE',
      optimizeForSize: true,
      includeDefaultValues: false,
      validateTypes: false
    });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  test('deserialize with full SerializationOptions', () => {
    const u8 = serialize({ z: true }, 'pack');
    const back = deserialize(
      u8,
      'pack',
      {
        wireFamily: 'deuk',
        endianness: 'LE',
        optimizeForSize: true,
        includeDefaultValues: false,
        validateTypes: false
      }
    );
    expect(back).toEqual({ z: true });
  });

  test('interop tbinary + targetType', () => {
    const root: DeukPackStruct = {
      name: 'Box',
      fields: [{ id: 1, name: 'n', type: 'int32', required: true }]
    };
    const obj = { n: 7 };
    const bytes = serialize(obj, 'tbinary', { interopRootStruct: root });
    class Box {
      n = 0;
    }
    const out = deserialize(bytes, 'tbinary', { interopRootStruct: root, targetType: Box });
    expect(out).toBeInstanceOf(Box);
    expect((out as Box).n).toBe(7);
  });

  /** Protobuf 바이너리 와이어(varint 태그·LEN 문자열). 공식 런타임과의 교차 검증은 별도(골든 바이트·protoc) 필요. */
  test('interop protv3 roundtrip (protobuf-style wire)', () => {
    const root: DeukPackStruct = {
      name: 'Box',
      fields: [
        { id: 1, name: 'n', type: 'int32', required: true },
        { id: 2, name: 's', type: 'string', required: false }
      ]
    };
    const obj = { n: 7, s: 'hi' };
    const bytes = serialize(obj, 'protv3', { interopRootStruct: root });
    const back = deserialize<typeof obj>(bytes, 'protv3', { interopRootStruct: root });
    expect(back).toEqual(obj);
  });
});
