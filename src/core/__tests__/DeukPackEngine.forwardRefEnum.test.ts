import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeukPackEngine } from '../DeukPackEngine';

function norm(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

describe('parseFileWithIncludes — forward-ref placeholder enums', () => {
  it('attributes placeholder enum to a file with real defs, not include-only stub', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deuk-fwdref-'));
    const stub = path.join(dir, 'stub.deuk');
    const real = path.join(dir, 'real.deuk');
    await fs.writeFile(stub, `namespace g;\ninclude "real.deuk"\n`, 'utf8');
    await fs.writeFile(
      real,
      `namespace g;\nrecord R { 1> g.placeholder_e kind; }\n`,
      'utf8'
    );
    const engine = new DeukPackEngine();
    const ast = await engine.parseFileWithIncludes(stub, { includePaths: [dir] });
    const ph = ast.enums.filter((e) => e.forwardRefPlaceholder === true && e.name === 'placeholder_e');
    expect(ph.length).toBe(1);
    expect(norm(ph[0]!.sourceFile!)).toBe(norm(real));
  });
});
