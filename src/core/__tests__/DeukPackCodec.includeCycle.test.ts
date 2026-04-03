import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeukPackCodec } from '../DeukPackCodec';

describe('parseFileWithIncludes — include graph', () => {
  it('terminates on mutual includes (A ↔ B) without infinite recursion', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deuk-include-cycle-'));
    const a = path.join(dir, 'a.deuk');
    const b = path.join(dir, 'b.deuk');
    await fs.writeFile(
      a,
      `namespace n;\ninclude "b.deuk"\nrecord Ra { 1> int32 x; }\n`,
      'utf8'
    );
    await fs.writeFile(
      b,
      `namespace n;\ninclude "a.deuk"\nrecord Rb { 1> int32 y; }\n`,
      'utf8'
    );
    const engine = new DeukPackCodec();
    const ast = await engine.parseFileWithIncludes(a, { includePaths: [dir] });
    expect(ast.filesProcessed).toBe(2);
    const names = ast.structs.map((s) => s.name).sort();
    expect(names).toContain('Ra');
    expect(names).toContain('Rb');
  });

  it('parses each physical file once when paths differ only by .. segments', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deuk-include-dedup-'));
    const sub = path.join(dir, 'sub');
    await fs.mkdir(sub, { recursive: true });
    const a = path.join(dir, 'a.deuk');
    const b = path.join(sub, 'b.deuk');
    await fs.writeFile(
      a,
      `namespace n;\ninclude "sub/b.deuk"\nrecord Ra { 1> int32 x; }\n`,
      'utf8'
    );
    await fs.writeFile(
      b,
      `namespace n;\ninclude "../a.deuk"\nrecord Rb { 1> int32 y; }\n`,
      'utf8'
    );
    const engine = new DeukPackCodec();
    const ast = await engine.parseFileWithIncludes(a, { includePaths: [dir] });
    expect(ast.filesProcessed).toBe(2);
  });
});
