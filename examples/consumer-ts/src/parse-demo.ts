/**
 * TypeScript: use DeukPack engine parse API (v1 — multi-lang emit via CLI).
 */
import * as path from 'path';
import { DeukPackCodec } from 'deukpack';

async function main(): Promise<void> {
  const engine = new DeukPackCodec();
  const idl = path.join(__dirname, '..', '..', 'sample_idl', 'sample.thrift');
  const ast = await engine.parseFileWithIncludes(idl, {
    includePaths: [path.dirname(idl)],
  });
  const names = ast.structs.map((s) => s.name).join(', ');
  console.log('Parsed structs:', names || '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
