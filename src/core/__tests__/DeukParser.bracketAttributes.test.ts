/**
 * .deuk inline `[]`: [c#: …] / neutral tags vs legacy [PascalCase(…)]
 */

import { DeukParser } from '../DeukParser';

describe('DeukParser: bracket attributes', () => {
  const parser = new DeukParser();

  it('parses struct-level [table:x] as deukBracketAttributes', () => {
    const src = `
namespace n
entity User [table:app_users] {
  1> int64 id
}
`;
    const ast = parser.parse(src, 't.deuk');
    const u = ast.structs.find((s) => s.name === 'User');
    expect(u?.deukBracketAttributes).toEqual(['table:app_users']);
  });

  it('parses [c#: …] into csharpAttributes (prefix stripped)', () => {
    const src = `
namespace n
record R {
  1> [c#: JsonIgnore] string secret
}
`;
    const ast = parser.parse(src, 't.deuk');
    const f = ast.structs[0]!.fields[0]!;
    expect(f.csharpAttributes).toEqual(['[JsonIgnore]']);
    expect(f.deukBracketAttributes).toBeUndefined();
  });

  it('parses [csharp: …] like [c#: …]', () => {
    const src = `
namespace n
record R {
  1> [csharp: Obsolete("old")] int32 x
}
`;
    const ast = parser.parse(src, 't.deuk');
    expect(ast.structs[0]!.fields[0]!.csharpAttributes).toEqual(['[Obsolete("old")]']);
  });

  it('parses neutral [key] on field', () => {
    const src = `
namespace n
entity Row {
  1> [key] int64 dbId
}
`;
    const ast = parser.parse(src, 't.deuk');
    const f = ast.structs[0]!.fields[0]!;
    expect(f.deukBracketAttributes).toEqual(['key']);
  });

  it('skips non-official [column:…] and [MaxLength(…)] (no AST attrs; not declaration-kind rules)', () => {
    const src = `
namespace n
record R {
  1> [column:col_x] [MaxLength(10)] int64 id
}
`;
    const ast = parser.parse(src, 't.deuk');
    const f = ast.structs[0]!.fields[0]!;
    expect(f.deukBracketAttributes).toBeUndefined();
    expect(f.csharpAttributes).toBeUndefined();
  });

  it('parses message-level bracket after name', () => {
    const src = `
namespace n
message<1> Ping [c#: Serializable] {
  2> int32 tick
}
`;
    const ast = parser.parse(src, 't.deuk');
    const m = ast.structs.find((s) => s.name === 'Ping');
    expect(m?.csharpAttributes).toEqual(['[Serializable]']);
  });
});
