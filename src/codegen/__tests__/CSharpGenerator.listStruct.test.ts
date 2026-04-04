/**
 * DeukPack C# Generator: 복합 컬렉션 및 Clone (Deep Nesting) 유닛 테스트
 * 
 * 중첩된 리스트/맵 구조체에 대한 Deep Copy(Clone) 및 In-place Read(ReadListInto) 생성을 검증한다.
 */

import { CSharpGenerator } from '../CSharpGenerator';
import type { DeukPackAST, DeukPackStruct, DeukPackNamespace } from '../../types/DeukPackTypes';

function buildComplexAst(): DeukPackAST {
  const ns: DeukPackNamespace = { language: '*', name: 'deuk.test', sourceFile: 'test.deuk' };

  const structNested: DeukPackStruct = {
    name: 'NestedStruct',
    sourceFile: 'test.deuk',
    fields: [
      { id: 1, name: 'inner_val', type: 'string', required: false },
      { id: 2, name: 'numbers', type: { type: 'list', elementType: 'int32' } as any, required: false },
    ],
  };

  const structComplex: DeukPackStruct = {
    name: 'ComplexListModel',
    sourceFile: 'test.deuk',
    fields: [
      { id: 1, name: 'name', type: 'string', required: false },
      { id: 2, name: 'items', type: { type: 'list', elementType: 'deuk.test.NestedStruct' } as any, required: false },
      { id: 3, name: 'lookup', type: { type: 'map', keyType: 'string', valueType: 'deuk.test.NestedStruct' } as any, required: false },
    ],
  };

  return {
    namespaces: [ns],
    structs: [structNested, structComplex],
    enums: [],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: {
      'test.deuk': 'deuk.test',
    },
  };
}

describe('CSharpGenerator: Complex Collection & Clone (Deep Nesting)', () => {
  const ast = buildComplexAst();
  const generator = new CSharpGenerator();

  it('Clone() 메소드에서 LINQ 대신 DeukPackCodec.CloneList/CloneMap을 사용해야 한다', async () => {
    const code = await generator.generate(ast, { csharpNullable: false } as any);
    const content = code['test_deuk.cs'];

    // List Clone 검증
    expect(content).toContain('DeukPackCodec.CloneList<deuk.test.NestedStruct>');
    expect(content).toContain('item => (deuk.test.NestedStruct)item.Clone()');
    
    // Map Clone 검증
    expect(content).toContain('DeukPackCodec.CloneMap<string, deuk.test.NestedStruct>');
    
    // LINQ .Select() 가 리스트 클론에서 제거되었는지 확인
    expect(content).not.toMatch(/\.Items\.Select\(.*\)\.ToList\(\)/);
  });

  it('Read() 메소드에서 ReadListInto/ReadMapInto를 사용하여 인스턴스를 재사용해야 한다', async () => {
    const code = await generator.generate(ast, { csharpNullable: false } as any);
    const content = code['test_deuk.cs'];

    // List Read 검증: ??= new List<T>() 후 ReadListInto 호출
    expect(content).toContain('this.Items ??= new List<deuk.test.NestedStruct>();');
    expect(content).toContain('DeukPackCodec.ReadListInto<deuk.test.NestedStruct>(iprot, DpWireType.Struct, this.Items');

    // Map Read 검증: ??= new Dictionary<K,V>() 후 ReadMapInto 호출
    expect(content).toContain('this.Lookup ??= new Dictionary<string, deuk.test.NestedStruct>();');
    expect(content).toContain('DeukPackCodec.ReadMapInto<string, deuk.test.NestedStruct>(iprot, DpWireType.String, DpWireType.Struct, this.Lookup');
  });

  it('Primitive 리스트 클론은 단순 new List<T>(source)를 사용해야 한다', async () => {
    // NestedStruct의 numbers 필드 (list<int32>)
    const code = await generator.generate(ast, { csharpNullable: false } as any);
    const content = code['test_deuk.cs'];

    // Primitive list clone 최적화 확인
    expect(content).toContain('clone.Numbers = this.Numbers != null ? (new List<int>(this.Numbers)) : null!;');
  });
});
