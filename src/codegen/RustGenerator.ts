import { DeukPackAST, GenerationOptions, DeukPackEnum } from '../types/DeukPackTypes';
import { CodeGenerator } from './CodeGenerator';
import { RustStructGenerator } from './rust/RustStructGenerator';
import { RustTypeHelper } from './rust/RustTypeHelper';

export class RustGenerator extends CodeGenerator {
  private structGen = new RustStructGenerator();

  public async generate(ast: DeukPackAST, options: GenerationOptions): Promise<{ [filename: string]: string }> {
    const files: { [filename: string]: string } = {};
    const rustNamespace = (options as any).rustNamespace || options.namespacePrefix || 'deukpack_generated';
    const pkgPath = rustNamespace.replace(/\./g, '/');

    // 1. Generate Structs
    for (const struct of ast.structs) {
      const filename = `${pkgPath}/${RustTypeHelper.toSnakeCase(struct.name)}.rs`;
      files[filename] = this.structGen.generate(struct, ast);
    }

    // 2. Generate Enums
    for (const enm of ast.enums) {
      const filename = `${pkgPath}/${RustTypeHelper.toSnakeCase(enm.name)}.rs`;
      files[filename] = this.generateEnum(enm);
    }

    // 3. Generate mod.rs (Module management)
    const modules = [...ast.structs, ...ast.enums]
      .map(item => `pub mod ${RustTypeHelper.toSnakeCase(item.name)};`)
      .join('\n');
    files[`${pkgPath}/mod.rs`] = modules;

    return files;
  }

  private generateEnum(enm: DeukPackEnum): string {
    const values = Object.entries(enm.values)
      .map(([name, value]) => `    ${name} = ${value},`)
      .join('\n');

    return `
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ${enm.name} {
${values}
}

impl From<i32> for ${enm.name} {
    fn from(v: i32) -> Self {
        match v {
${Object.entries(enm.values).map(([name, value]) => `            ${value} => Self::${name},`).join('\n')}
            _ => Self::${Object.keys(enm.values)[0]}, // Default bit
        }
    }
}
`;
  }
}
