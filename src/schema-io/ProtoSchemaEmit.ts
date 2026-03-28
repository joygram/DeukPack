/**
 * DeukPack AST → Protocol Buffers v3 schema text (minimal subset for bench / tooling).
 * Unsupported complex types are emitted as string with a leading comment on the field.
 */

import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackField,
  DeukPackType,
  DeukPackEnum,
} from '../types/DeukPackTypes';

function sanitizePackage(ns: string): string {
  return ns.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_|_$/g, '') || 'bench';
}

function fieldTypeToProto(
  _field: DeukPackField,
  type: DeukPackType,
  ast: DeukPackAST
): { protoType: string; comment?: string } {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return { protoType: 'bool' };
      case 'byte':
      case 'int8':
      case 'int16':
      case 'int32':
      case 'uint8':
      case 'uint16':
      case 'uint32':
        return { protoType: 'int32' };
      case 'int64':
      case 'uint64':
        return { protoType: 'int64' };
      case 'float':
        return { protoType: 'float' };
      case 'double':
        return { protoType: 'double' };
      case 'string':
        return { protoType: 'string' };
      case 'binary':
        return { protoType: 'bytes' };
      default: {
        const ref = type.includes('.') ? type.split('.').pop()! : type;
        const hasStruct = ast.structs?.some((s) => s.name === ref || s.name.endsWith('.' + ref));
        const hasEnum = ast.enums?.some((e) => e.name === ref || e.name.endsWith('.' + ref));
        if (hasStruct || hasEnum) {
          return { protoType: ref };
        }
        return { protoType: 'string', comment: ` deuk type ${type}` };
      }
    }
  }
  if (typeof type === 'object' && type !== null) {
    if ('type' in type && type.type === 'tablelink') {
      return { protoType: 'string', comment: ' tablelink' };
    }
    if (type.type === 'list' || type.type === 'array' || type.type === 'set') {
      const inner = fieldTypeToProto(_field, type.elementType, ast);
      return {
        protoType: `repeated ${inner.protoType}`,
        ...(inner.comment !== undefined ? { comment: inner.comment } : {}),
      };
    }
    if (type.type === 'map') {
      return { protoType: 'string', comment: ' map (simplified)' };
    }
  }
  return { protoType: 'string', comment: ' unknown' };
}

function emitEnum(e: DeukPackEnum): string[] {
  const out: string[] = [];
  out.push(`enum ${e.name} {`);
  const keys = Object.keys(e.values || {}).sort(
    (a, b) => (e.values![a] ?? 0) - (e.values![b] ?? 0)
  );
  for (const k of keys) {
    const v = e.values![k];
    out.push(`  ${k} = ${v};`);
  }
  out.push('}');
  return out;
}

function emitMessage(s: DeukPackStruct, ast: DeukPackAST): string[] {
  const name = s.name.includes('.') ? s.name.split('.').pop()! : s.name;
  const out: string[] = [];
  out.push(`message ${name} {`);
  for (const f of s.fields || []) {
    const { protoType, comment } = fieldTypeToProto(f, f.type, ast);
    const tail = comment ? ` //${comment}` : '';
    out.push(`  ${protoType} ${f.name} = ${f.id};${tail}`);
  }
  out.push('}');
  return out;
}

/**
 * Emit a single .proto document for all structs and enums in the AST.
 */
export function generateProtoSchemaFromAst(ast: DeukPackAST): string {
  const pkgRaw = ast.namespaces?.[0]?.name ?? 'bench';
  const pkg = sanitizePackage(pkgRaw);
  const lines: string[] = [];
  lines.push('syntax = "proto3";');
  lines.push('');
  lines.push(`package ${pkg};`);
  lines.push('');

  for (const e of ast.enums || []) {
    const short = e.name.includes('.') ? e.name.split('.').pop()! : e.name;
    const body = emitEnum({ ...e, name: short });
    lines.push(...body);
    lines.push('');
  }

  for (const s of ast.structs || []) {
    lines.push(...emitMessage(s, ast));
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
