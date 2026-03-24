import {
  buildEmbeddedStructSchema,
  getEmbeddedSchemaTypeInfo,
} from '../embeddedStructSchema';
import type { DeukPackAST, DeukPackEnum, DeukPackStruct } from '../../types/DeukPackTypes';

function minimalAst(partial?: Partial<DeukPackAST>): DeukPackAST {
  return {
    namespaces: [],
    structs: [],
    enums: [],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: {},
    ...partial,
  };
}

describe('getEmbeddedSchemaTypeInfo', () => {
  const ast = minimalAst();

  test('legacy int aliases map to int* + Deuk typeName', () => {
    expect(getEmbeddedSchemaTypeInfo('i8', ast)).toEqual({ type: 'int8', typeName: 'int8' });
    expect(getEmbeddedSchemaTypeInfo('i16', ast)).toEqual({ type: 'int16', typeName: 'int16' });
    expect(getEmbeddedSchemaTypeInfo('i32', ast)).toEqual({ type: 'int32', typeName: 'int32' });
    expect(getEmbeddedSchemaTypeInfo('i64', ast)).toEqual({ type: 'int64', typeName: 'int64' });
  });

  test('canonical primitives and thrift-style shorthands', () => {
    expect(getEmbeddedSchemaTypeInfo('bool', ast)).toEqual({ type: 'bool', typeName: 'bool' });
    expect(getEmbeddedSchemaTypeInfo('tf', ast)).toEqual({ type: 'bool', typeName: 'bool' });
    expect(getEmbeddedSchemaTypeInfo('str', ast)).toEqual({ type: 'string', typeName: 'string' });
    expect(getEmbeddedSchemaTypeInfo('dbl', ast)).toEqual({ type: 'double', typeName: 'double' });
    expect(getEmbeddedSchemaTypeInfo('byte', ast)).toEqual({ type: 'byte', typeName: 'byte' });
    expect(getEmbeddedSchemaTypeInfo('timestamp', ast)).toEqual({
      type: 'timestamp',
      typeName: 'timestamp',
    });
    expect(getEmbeddedSchemaTypeInfo('decimal', ast)).toEqual({ type: 'decimal', typeName: 'decimal' });
    expect(getEmbeddedSchemaTypeInfo('numeric', ast)).toEqual({ type: 'numeric', typeName: 'numeric' });
  });

  test('list / set / map nesting uses Deuk typeName spelling', () => {
    expect(
      getEmbeddedSchemaTypeInfo({ type: 'list', elementType: 'int32' }, ast)
    ).toEqual({ type: 'list', typeName: 'list<int32>' });
    expect(
      getEmbeddedSchemaTypeInfo({ type: 'set', elementType: 'string' }, ast)
    ).toEqual({ type: 'set', typeName: 'set<string>' });
    expect(
      getEmbeddedSchemaTypeInfo(
        { type: 'map', keyType: 'string', valueType: { type: 'list', elementType: 'bool' } },
        ast
      )
    ).toEqual({ type: 'map', typeName: 'map<string,list<bool>>' });
  });

  test('tablelink', () => {
    expect(
      getEmbeddedSchemaTypeInfo(
        { type: 'tablelink', tableCategory: 'Item', keyField: 'id' } as any,
        ast
      )
    ).toEqual({ type: 'tablelink', typeName: 'tablelink<Item,id>' });
  });

  test('enum by simple name or dotted suffix', () => {
    const enums: DeukPackEnum[] = [
      { name: 'ns.Status', sourceFile: 'a.deuk', values: { OK: 0 } },
    ];
    const a = minimalAst({ enums });
    expect(getEmbeddedSchemaTypeInfo('Status', a)).toEqual({ type: 'enum', typeName: 'ns.Status' });
    expect(getEmbeddedSchemaTypeInfo('ns.Status', a)).toEqual({ type: 'enum', typeName: 'ns.Status' });
  });

  test('unresolved string type becomes struct reference', () => {
    expect(getEmbeddedSchemaTypeInfo('MyRow', ast)).toEqual({ type: 'struct', typeName: 'MyRow' });
  });

  test('empty / unknown object shape falls back to struct object', () => {
    expect(getEmbeddedSchemaTypeInfo(undefined, ast)).toEqual({ type: 'struct', typeName: 'object' });
    expect(getEmbeddedSchemaTypeInfo({} as any, ast)).toEqual({ type: 'struct', typeName: 'object' });
  });
});

describe('buildEmbeddedStructSchema', () => {
  test('field entries use Deuk schema type (not Thrift wire keys)', () => {
    const st: DeukPackStruct = {
      name: 'Row',
      sourceFile: 't.deuk',
      fields: [
        { id: 1, name: 'n', type: 'int32', required: true },
        { id: 2, name: 'tags', type: { type: 'set', elementType: 'string' }, required: false },
      ],
    };
    const schema = buildEmbeddedStructSchema(st, minimalAst()) as Record<string, unknown>;
    expect(schema['name']).toBe('Row');
    expect(schema['type']).toBe('struct');
    const fields = schema['fields'] as Record<string, Record<string, unknown>>;
    expect(fields[1]).toMatchObject({
      id: 1,
      name: 'n',
      type: 'int32',
      typeName: 'int32',
      required: true,
    });
    expect(fields[2]).toMatchObject({
      id: 2,
      name: 'tags',
      type: 'set',
      typeName: 'set<string>',
      required: false,
    });
  });

  test('omits empty annotations; keeps docComment when set', () => {
    const st: DeukPackStruct = {
      name: 'Doc',
      sourceFile: 't.deuk',
      docComment: 'hello',
      annotations: {},
      fields: [{ id: 1, name: 'x', type: 'bool', required: false }],
    };
    const schema = buildEmbeddedStructSchema(st, minimalAst()) as Record<string, unknown>;
    expect(schema['docComment']).toBe('hello');
    expect(schema['annotations']).toBeUndefined();
  });
});
