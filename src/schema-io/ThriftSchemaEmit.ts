/**
 * DeukPack AST → Thrift IDL text (minimal subset for generated / tooling).
 */

import { DeukPackAST, DeukPackStruct, DeukPackType, DeukPackEnum } from '../types/DeukPackTypes';

function fieldTypeToThrift(type: DeukPackType, ast: DeukPackAST): { thriftType: string; comment?: string } {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return { thriftType: 'bool' };
      case 'byte':
      case 'int8':
        return { thriftType: 'byte' };
      case 'int16':
        return { thriftType: 'i16' };
      case 'int32':
      case 'uint8':
      case 'uint16':
      case 'uint32':
        return { thriftType: 'i32' };
      case 'int64':
      case 'uint64':
        return { thriftType: 'i64' };
      case 'float':
        return { thriftType: 'double' };
      case 'double':
        return { thriftType: 'double' };
      case 'string':
        return { thriftType: 'string' };
      case 'binary':
        return { thriftType: 'binary' };
      default: {
        const ref = type.includes('.') ? type.split('.').pop()! : type;
        const hasStruct = ast.structs?.some((s) => s.name === ref || s.name.endsWith('.' + ref));
        const hasEnum = ast.enums?.some((e) => e.name === ref || e.name.endsWith('.' + ref));
        if (hasStruct || hasEnum) {
          return { thriftType: ref };
        }
        return { thriftType: 'string', comment: ` /* deuk ${type} */` };
      }
    }
  }
  if (typeof type === 'object' && type !== null) {
    if ('type' in type && type.type === 'tablelink') {
      return { thriftType: 'string', comment: ' /* tablelink */' };
    }
    if (type.type === 'list' || type.type === 'array') {
      const inner = fieldTypeToThrift(type.elementType, ast);
      return {
        thriftType: `list<${inner.thriftType}>`,
        ...(inner.comment !== undefined ? { comment: inner.comment } : {}),
      };
    }
    if (type.type === 'set') {
      const inner = fieldTypeToThrift(type.elementType, ast);
      return {
        thriftType: `set<${inner.thriftType}>`,
        ...(inner.comment !== undefined ? { comment: inner.comment } : {}),
      };
    }
    if (type.type === 'map') {
      const kt = fieldTypeToThrift(type.keyType, ast);
      const vt = fieldTypeToThrift(type.valueType, ast);
      return { thriftType: `map<${kt.thriftType},${vt.thriftType}>`, comment: ' /* simplified */' };
    }
  }
  return { thriftType: 'string' };
}

function emitEnum(e: DeukPackEnum): string[] {
  const name = e.name.includes('.') ? e.name.split('.').pop()! : e.name;
  const out: string[] = [];
  out.push(`enum ${name} {`);
  const keys = Object.keys(e.values || {}).sort(
    (a, b) => (e.values![a] ?? 0) - (e.values![b] ?? 0)
  );
  for (const k of keys) {
    const v = e.values![k];
    out.push(`  ${k} = ${v},`);
  }
  out.push('}');
  return out;
}

function emitStruct(s: DeukPackStruct, ast: DeukPackAST): string[] {
  const name = s.name.includes('.') ? s.name.split('.').pop()! : s.name;
  const out: string[] = [];
  out.push(`struct ${name} {`);
  for (const f of s.fields || []) {
    const { thriftType, comment } = fieldTypeToThrift(f.type, ast);
    out.push(`  ${f.id}: ${thriftType} ${f.name};${comment ?? ''}`);
  }
  out.push('}');
  return out;
}

/**
 * Emit a single .thrift document for all structs and enums in the AST.
 */
export function generateThriftSchemaFromAst(ast: DeukPackAST): string {
  const ns = ast.namespaces?.[0]?.name ?? 'generated';
  const lines: string[] = [];
  lines.push(`namespace * ${ns}`);
  lines.push('');

  for (const e of ast.enums || []) {
    lines.push(...emitEnum(e));
    lines.push('');
  }

  for (const s of ast.structs || []) {
    lines.push(...emitStruct(s, ast));
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
