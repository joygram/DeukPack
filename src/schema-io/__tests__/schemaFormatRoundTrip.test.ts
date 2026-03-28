/**
 * Schema-shape round-trips: Deuk AST → emit → parse → AST (per DEUKPACK_SCHEMA_FORMAT_ROUNDTRIP / OPENAPI docs).
 * CSV/JSON restore column names only (types default to string). Proto/Thrift/OpenAPI preserve primitive mapping where supported.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { DeukPackAST, DeukPackStruct } from '../../types/DeukPackTypes';
import { emitDelimitedFromStruct, parseDelimitedToStruct } from '../DelimitedSchema';
import { emitJsonFromStruct, parseJsonToStruct } from '../JsonSchema';
import { generateOpenApiFromAst } from '../../openapi/OpenApiGenerator';
import { parseOpenApiToAst } from '../../openapi/OpenApiParser';
import { generateProtoSchemaFromAst } from '../ProtoSchemaEmit';
import { generateThriftSchemaFromAst } from '../ThriftSchemaEmit';
import { ProtoParser } from '../../core/ProtoParser';
import { IdlParser } from '../../core/IdlParser';
import { DeukParser } from '../../core/DeukParser';

function fieldSignature(struct: DeukPackStruct): { name: string; id: number; type: string }[] {
  return (struct.fields || []).map((f) => ({
    name: f.name,
    id: f.id,
    type: typeof f.type === 'string' ? f.type : JSON.stringify(f.type),
  }));
}

const hasXlsxRuntime = ((): boolean => {
  try {
    require.resolve('xlsx');
    return true;
  } catch {
    return false;
  }
})();

function expectSameFieldShape(
  a: DeukPackStruct,
  b: DeukPackStruct,
  mode: 'names-and-ids' | 'full'
): void {
  const fa = fieldSignature(a);
  const fb = fieldSignature(b);
  expect(fb.length).toBe(fa.length);
  for (let i = 0; i < fa.length; i++) {
    expect(fb[i]?.name).toBe(fa[i]!.name);
    expect(fb[i]?.id).toBe(fa[i]!.id);
    if (mode === 'full') {
      expect(fb[i]?.type).toBe(fa[i]!.type);
    }
  }
}

const sampleAst = (): DeukPackAST => ({
  namespaces: [{ language: '*', name: 'rt.bench', sourceFile: 'rt.deuk' }],
  structs: [
    {
      name: 'Row',
      sourceFile: 'rt.deuk',
      fields: [
        { id: 1, name: 'id', type: 'int32', required: true },
        { id: 2, name: 'label', type: 'string', required: false },
        { id: 3, name: 'ok', type: 'bool', required: false },
      ],
    },
  ],
  enums: [
    {
      name: 'Status',
      sourceFile: 'rt.deuk',
      values: { ON: 0, OFF: 1 },
    },
  ],
  services: [],
  typedefs: [],
  constants: [],
  includes: [],
  fileNamespaceMap: {},
});

describe('schema format round-trip', () => {
  const row = (): DeukPackStruct => sampleAst().structs[0]!;
  const src = 'rt.deuk';

  test('CSV: emit header → parse → same names & ids (types → string)', () => {
    const s = row();
    const csv = emitDelimitedFromStruct(s, ',');
    const back = parseDelimitedToStruct(csv, ',', s.name, src);
    expectSameFieldShape(s, back, 'names-and-ids');
    expect(back.fields?.every((f) => f.type === 'string')).toBe(true);
  });

  test('PSV: emit header → parse → same names & ids', () => {
    const s = row();
    const psv = emitDelimitedFromStruct(s, '|');
    const back = parseDelimitedToStruct(psv, '|', s.name, src);
    expectSameFieldShape(s, back, 'names-and-ids');
  });

  test('JSON schema shape: emit → parse → same names & ids', () => {
    const s = row();
    const jsonText = emitJsonFromStruct(s);
    const data = JSON.parse(jsonText) as unknown;
    const back = parseJsonToStruct(data, s.name, src);
    expect(back).not.toBeNull();
    expectSameFieldShape(s, back!, 'names-and-ids');
    expect(back!.fields?.every((f) => f.type === 'string')).toBe(true);
  });

  test('OpenAPI: generate spec → parseOpenApiToAst → Row fields + Status enum', () => {
    const ast = sampleAst();
    const spec = generateOpenApiFromAst(ast, { title: 'RtBench', version: '0.0.1' });
    const back = parseOpenApiToAst(spec, 'roundtrip.yaml');
    const rowBack = back.structs.find((x) => x.name === 'Row');
    expect(rowBack).toBeDefined();
    expectSameFieldShape(ast.structs[0]!, rowBack!, 'full');
    const stEnum = back.enums.find((e) => e.name === 'Status');
    expect(stEnum).toBeDefined();
    expect(Object.keys(stEnum!.values || {}).sort()).toEqual(['OFF', 'ON']);
  });

  test('Protobuf: emit → ProtoParser → Row + Status', () => {
    const ast = sampleAst();
    const text = generateProtoSchemaFromAst(ast);
    const protoAst = new ProtoParser().parse(text, 'rt.proto');
    const rowBack = protoAst.structs.find((x) => x.name === 'Row' || x.name.endsWith('.Row'));
    expect(rowBack).toBeDefined();
    const short = rowBack!.name.includes('.') ? rowBack!.name.split('.').pop()! : rowBack!.name;
    expect(short).toBe('Row');
    expectSameFieldShape(ast.structs[0]!, rowBack!, 'full');
    const en = protoAst.enums.find((e) => e.name === 'Status' || e.name.endsWith('.Status'));
    expect(en).toBeDefined();
  });

  test('Deuk: parse .deuk → OpenAPI → parseOpenApi → Row fields', () => {
    const deuk = `namespace rt.bench

record Row {
    1> int32 id
    2> string label
    3> bool ok
}
`;
    const deukAst = new DeukParser().parse(deuk, 'inline.deuk');
    const row0 = deukAst.structs.find((x) => x.name === 'Row' || x.name.endsWith('.Row'));
    expect(row0).toBeDefined();
    const spec = generateOpenApiFromAst(deukAst, { title: 'RtBench', version: '0.0.1' });
    const back = parseOpenApiToAst(spec, 'roundtrip.yaml');
    const rowBack = back.structs.find((x) => x.name === 'Row');
    expect(rowBack).toBeDefined();
    expectSameFieldShape(row0!, rowBack!, 'full');
  });

  test('Thrift: emit → IdlParser → Row + Status', () => {
    const ast = sampleAst();
    const text = generateThriftSchemaFromAst(ast);
    const idlAst = new IdlParser().parseContent(text, 'rt.thrift');
    const rowBack = idlAst.structs.find((x) => {
      const n = x.name.includes('.') ? x.name.split('.').pop()! : x.name;
      return n === 'Row';
    });
    expect(rowBack).toBeDefined();
    expectSameFieldShape(ast.structs[0]!, rowBack!, 'full');
    const en = idlAst.enums.find((e) => {
      const n = e.name.includes('.') ? e.name.split('.').pop()! : e.name;
      return n === 'Status';
    });
    expect(en).toBeDefined();
  });
});

(hasXlsxRuntime ? describe : describe.skip)('schema format round-trip (Excel)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deukpack-rt-xlsx-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test('Excel: emit xlsx → parse → same names & ids', () => {
    const { emitExcelFromStruct } = require('../ExcelSchema') as typeof import('../ExcelSchema');
    const { parseExcelFileToAst } = require('../ExcelSchema') as typeof import('../ExcelSchema');

    const s: DeukPackStruct = {
      name: 'SheetOne',
      sourceFile: 'x.xlsx',
      fields: [
        { id: 1, name: 'a', type: 'int32', required: false },
        { id: 2, name: 'b_col', type: 'string', required: false },
      ],
    };
    const outPath = path.join(tmpDir, 'out.xlsx');
    emitExcelFromStruct(s, outPath);
    const ast = parseExcelFileToAst(outPath, outPath);
    const back = ast.structs[0];
    expect(back).toBeDefined();
    expectSameFieldShape(s, back!, 'names-and-ids');
  });
});
