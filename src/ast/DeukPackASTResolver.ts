/**
 * DeukPack AST Resolver & Validator
 *
 * Handles inheritance (extends) resolution and schema validation.
 */

import { DeukPackAST, DeukPackStruct, DeukPackError } from '../types/DeukPackTypes';

export class DeukPackASTResolver {
  /**
   * Resolve struct extends: prepend parent fields into child (flat merge).
   * Supports multi-level inheritance. Throws on field ID collision.
   */
  static resolveExtends(ast: DeukPackAST): void {
    if ((ast as any)._extendsResolved) return;

    const byName = new Map<string, DeukPackStruct>();
    for (const s of ast.structs) {
      byName.set(s.name, s);
      const dotIdx = s.name.lastIndexOf('.');
      if (dotIdx >= 0) byName.set(s.name.slice(dotIdx + 1), s);
    }

    const resolved = new Set<string>();
    const resolving = new Set<string>();

    const resolve = (s: DeukPackStruct) => {
      if (resolved.has(s.name)) return;
      if (resolving.has(s.name)) throw new Error(`Circular extends: ${s.name}`);
      if (!s.extends) {
        resolved.add(s.name);
        return;
      }

      resolving.add(s.name);

      const parentName = s.extends;
      const parent = byName.get(parentName);
      if (!parent) throw new Error(`struct ${s.name} extends unknown type '${parentName}'`);
      
      resolve(parent);

      const childIds = new Set(s.fields.map(f => f.id));
      for (const pf of parent.fields) {
        if (childIds.has(pf.id)) {
          throw new Error(`Field ID ${pf.id} in parent '${parent.name}' collides with field in '${s.name}'`);
        }
      }

      s.fields = [...parent.fields, ...s.fields];
      resolving.delete(s.name);
      resolved.add(s.name);
    };

    for (const s of ast.structs) resolve(s);
    (ast as any)._extendsResolved = true;
  }

  /**
   * Validate schema: check for duplicate field IDs and enum values.
   */
  static validateSchema(ast: DeukPackAST): DeukPackError[] {
    const errors: DeukPackError[] = [];

    for (const structDef of ast.structs) {
      const fieldIds = new Set<number>();
      for (const field of structDef.fields) {
        if (fieldIds.has(field.id)) {
          errors.push({
            message: `Duplicate field ID ${field.id} in struct ${structDef.name}`,
            line: 0,
            column: 0,
            file: '',
            severity: 'error'
          });
        }
        fieldIds.add(field.id);
      }
    }

    for (const enumDef of ast.enums) {
      const values = new Set<number | bigint>();
      for (const [, value] of Object.entries(enumDef.values)) {
        if (values.has(value)) {
          errors.push({
            message: `Duplicate enum value ${value} in enum ${enumDef.name}`,
            line: 0,
            column: 0,
            file: '',
            severity: 'error'
          });
        }
        values.add(value);
      }
    }

    return errors;
  }
}
