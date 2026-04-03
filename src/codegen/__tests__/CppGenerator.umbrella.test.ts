import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeukPackCodec } from '../../core/DeukPackCodec';
import { CppGenerator } from '../cpp';
import type { GenerationOptions } from '../../types/DeukPackTypes';

describe('CppGenerator — output names and umbrella headers', () => {
  it('emits <stem>_deuk.h/.cpp and umbrella for include-only stub', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deuk-cpp-umb-'));
    const stub = path.join(dir, 'stub.deuk');
    const real = path.join(dir, 'real.deuk');
    await fs.writeFile(stub, `namespace g;\ninclude "real.deuk"\n`, 'utf8');
    await fs.writeFile(
      real,
      `namespace g;\nrecord R { 1> int32 x; }\n`,
      'utf8'
    );
    const engine = new DeukPackCodec();
    const ast = await engine.parseFileWithIncludes(stub, { includePaths: [dir] });
    const gen = new CppGenerator();
    const files = await gen.generate(ast, {} as GenerationOptions);

    expect(files['real_deuk.h']).toBeDefined();
    expect(files['real_deuk.cpp']).toBeDefined();
    expect(files['stub_deuk.h']).toBeDefined();
    expect(files['stub_deuk.cpp']).toBeDefined();
    expect(files['stub.h']).toBeUndefined();
    expect(files['stub_deuk.h']).toContain('Umbrella header');
    expect(files['stub_deuk.h']).toContain('#include "real_deuk.h"');
    expect(files['stub_deuk.h']).toContain('IDL namespace for this file (informational): g');
    expect(files['real_deuk.cpp']).toContain('#include "real_deuk.h"');
  });
});
