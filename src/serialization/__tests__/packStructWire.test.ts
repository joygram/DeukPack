import { structFromPackBinary, structToPackBinary } from '../packStructWire';
import type { EmbeddedPackStructSchema } from '../packStructWire';
import { deserialize, serialize } from '../../index';

describe('packStructWire vs WireSerializer pack', () => {
  const inner: EmbeddedPackStructSchema = {
    name: 'Inner',
    type: 'Struct',
    fields: {
      1: { id: 1, name: 'x', type: 'int32', typeName: 'int32', required: true },
      2: { id: 2, name: 'y', type: 'int32', typeName: 'int32', required: true },
    },
  };
  const root: EmbeddedPackStructSchema = {
    name: 'Root',
    type: 'Struct',
    fields: {
      1: { id: 1, name: 'id', type: 'int32', typeName: 'int32', required: true },
      2: { id: 2, name: 'name', type: 'string', typeName: 'string', required: false },
      3: { id: 3, name: 'inner', type: 'struct', typeName: 'Inner', required: true },
    },
  };
  const schemas: Record<string, EmbeddedPackStructSchema> = {
    Inner: inner,
    Root: root,
  };

  test('round-trip', () => {
    const obj = { id: 7, name: 't', inner: { x: 1, y: 2 } };
    const u8 = structToPackBinary(root, obj, schemas);
    const back = structFromPackBinary(root, u8, schemas);
    expect(back).toEqual(obj);
  });

  test('matches generic pack deserialize for same logical tree', () => {
    const obj = { id: 1, name: 'a', inner: { x: 10, y: 20 } };
    const u8 = structToPackBinary(root, obj, schemas);
    const generic = deserialize<Record<string, unknown>>(u8, 'pack');
    expect(generic).toEqual(obj);
  });

  test('serialize pack on plain object matches struct encoder shape', () => {
    const obj = { id: 2, name: 'b', inner: { x: 3, y: 4 } };
    const a = serialize(obj, 'pack');
    const b = structToPackBinary(root, obj, schemas);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
