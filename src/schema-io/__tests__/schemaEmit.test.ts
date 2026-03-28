import type { DeukPackAST } from '../../types/DeukPackTypes';
import { generateProtoSchemaFromAst } from '../ProtoSchemaEmit';
import { generateThriftSchemaFromAst } from '../ThriftSchemaEmit';

describe('ProtoSchemaEmit / ThriftSchemaEmit', () => {
  const miniAst: DeukPackAST = {
    namespaces: [{ language: '*', name: 'generated.sample', sourceFile: 't.deuk' }],
    structs: [
      {
        name: 'Row',
        sourceFile: 't.deuk',
        fields: [
          { id: 1, name: 'id', type: 'int32', required: false },
          { id: 2, name: 'name', type: 'string', required: false },
        ],
      },
    ],
    enums: [],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: {},
  };

  test('generateProtoSchemaFromAst', () => {
    const text = generateProtoSchemaFromAst(miniAst);
    expect(text).toContain('syntax = "proto3"');
    expect(text).toContain('package generated_sample');
    expect(text).toContain('message Row');
    expect(text).toContain('int32 id = 1');
    expect(text).toContain('string name = 2');
  });

  test('generateThriftSchemaFromAst', () => {
    const text = generateThriftSchemaFromAst(miniAst);
    expect(text).toContain('namespace * generated.sample');
    expect(text).toContain('struct Row');
    expect(text).toContain('1: i32 id');
    expect(text).toContain('2: string name');
  });
});
