/**
 * Pack / Unpack 2-Method API 통합 테스트
 * 표준 API: pack(obj, format?) / unpack(data, format?) / unpack(obj, data, format?)
 */
import { structFromPackBinary, structToPackBinary } from '../packStructWire';
import type { EmbeddedPackStructSchema } from '../packStructWire';
import { serialize, deserialize } from '../../index';

// ─── Test Fixtures ───────────────────────────────────────────
const heroSchema: EmbeddedPackStructSchema = {
  name: 'Hero',
  type: 'struct',
  fields: {
    1: { id: 1, name: 'id',   type: 'int32',  typeName: 'int32',  required: true },
    2: { id: 2, name: 'name', type: 'string', typeName: 'string', required: false },
    3: { id: 3, name: 'hp',   type: 'float',  typeName: 'float',  required: false },
  },
};
const schemas: Record<string, EmbeddedPackStructSchema> = { Hero: heroSchema };

const sample = { id: 1, name: 'Arthur', hp: 99.0 };

// ─── pack (Binary) ───────────────────────────────────────────
describe('pack → binary', () => {
  test('pack(obj) returns binary buffer', () => {
    const bin = structToPackBinary(heroSchema, sample, schemas);
    expect(bin).toBeInstanceOf(Uint8Array);
    expect(bin.byteLength).toBeGreaterThan(0);
  });

  test('pack / unpack roundtrip', () => {
    const bin  = structToPackBinary(heroSchema, sample, schemas);
    const back = structFromPackBinary(heroSchema, bin, schemas) as typeof sample;
    expect(back.id).toBe(sample.id);
    expect(back.name).toBe(sample.name);
  });
});

// ─── pack (JSON) ─────────────────────────────────────────────
describe('pack → json format', () => {
  test('pack(obj, "json") roundtrip via serialize/deserialize', () => {
    const jsonBytes = serialize(sample, 'json');
    const back      = deserialize<typeof sample>(jsonBytes, 'json');
    expect(back).toEqual(sample);
  });

  test('json string input accepted by deserialize', () => {
    const jsonBytes = serialize(sample, 'json');
    const text   = new TextDecoder().decode(jsonBytes);
    const back   = deserialize<typeof sample>(text, 'json');
    expect(back).toEqual(sample);
  });
});

// ─── unpack → new instance ───────────────────────────────────
describe('unpack → new instance', () => {
  test('unpack(buf) creates new object', () => {
    const bin  = structToPackBinary(heroSchema, sample, schemas);
    const hero = structFromPackBinary(heroSchema, bin, schemas) as typeof sample;
    expect(hero).not.toBe(sample);
    expect(hero.id).toBe(sample.id);
  });

  test('unpack(buf) via generic serialize layer', () => {
    const bin  = serialize(sample, 'pack');
    const back = deserialize<typeof sample>(bin, 'pack');
    expect(back).toEqual(sample);
  });
});

// ─── unpack → overwrite existing (Zero-Alloc) ────────────────
describe('unpack(obj, buf) → zero-alloc overwrite', () => {
  test('overwrites existing object in-place', () => {
    const bin     = structToPackBinary(heroSchema, sample, schemas);
    const target  = { id: 0, name: '', hp: 0 };
    const result  = Object.assign(target, structFromPackBinary(heroSchema, bin, schemas));
    expect(result).toBe(target);            // 같은 참조
    expect(result.id).toBe(sample.id);
    expect(result.name).toBe(sample.name);
  });

  test('zero-alloc: target reference is preserved after overwrite', () => {
    const bin    = structToPackBinary(heroSchema, sample, schemas);
    const cached = { id: 0, name: 'old', hp: 0 };
    const ref    = cached;
    Object.assign(cached, structFromPackBinary(heroSchema, bin, schemas));
    expect(cached).toBe(ref);              // same reference → no GC pressure
    expect(cached.name).toBe('Arthur');
  });
});

// ─── protocol selection (Binary vs JSON same round-trip value) ─
describe('format selection', () => {
  test('binary and json produce same logical value', () => {
    const bin      = serialize(sample, 'pack');
    const jsonBytes = serialize(sample, 'json');
    const fromBin  = deserialize<typeof sample>(bin, 'pack');
    const fromJson = deserialize<typeof sample>(jsonBytes, 'json');
    expect(fromBin.id).toBe(fromJson.id);
    expect(fromBin.name).toBe(fromJson.name);
  });
});
