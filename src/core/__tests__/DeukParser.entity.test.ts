/**
 * .deuk IDL: entity 키워드 → AST declarationKind 전환 검증
 */

import { DeukParser } from '../DeukParser';

describe('DeukParser: entity / declarationKind', () => {
  const parser = new DeukParser();

  it('entity 선언은 declarationKind 가 entity', () => {
    const src = `
namespace db_entity
entity User {
  1> int64 dbId
}
`;
    const ast = parser.parse(src, 'db_entity.deuk');
    const user = ast.structs.find((s) => s.name === 'User');
    expect(user).toBeDefined();
    expect(user!.declarationKind).toBe('entity');
    expect(user!.fields).toHaveLength(1);
    expect(user!.fields[0]!.name).toBe('dbId');
  });

  it('record 선언은 declarationKind 가 record', () => {
    const src = `
namespace game
record Foo {
  1> int32 a
}
`;
    const ast = parser.parse(src, 'foo.deuk');
    const foo = ast.structs.find((s) => s.name === 'Foo');
    expect(foo).toBeDefined();
    expect(foo!.declarationKind).toBe('record');
  });

  it('struct 는 record 와 동일 토큰 → declarationKind record', () => {
    const src = `
namespace game
struct Bar {
  1> bool ok
}
`;
    const ast = parser.parse(src, 'bar.deuk');
    const bar = ast.structs.find((s) => s.name === 'Bar');
    expect(bar).toBeDefined();
    expect(bar!.declarationKind).toBe('record');
  });

  it('한 파일에 entity 와 record 혼합', () => {
    const src = `
namespace db_entity
entity Row {
  1> int64 id
}
record Dto {
  1> int32 x
}
`;
    const ast = parser.parse(src, 'mix.deuk');
    expect(ast.structs.find((s) => s.name === 'Row')!.declarationKind).toBe('entity');
    expect(ast.structs.find((s) => s.name === 'Dto')!.declarationKind).toBe('record');
  });
});
