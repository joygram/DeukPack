/**
 * C# type conversion utilities
 */

import { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackTypedef, DeukPackType } from '../../types/DeukPackTypes';

export interface TypeContext {
  ast?: DeukPackAST;
  currentNamespace?: string;
  findTypedef: (ast: DeukPackAST, name: string, ns?: string) => DeukPackTypedef | null;
  findStruct: (ast: DeukPackAST, name: string, ns?: string) => DeukPackStruct | null;
  findEnumByFullName: (ast: DeukPackAST, name: string, ns?: string) => DeukPackEnum | null;
  resolveTypeToFullName: (type: string, ns: string | undefined, ast: DeukPackAST) => string;
  getStructFullName: (struct: DeukPackStruct, ast: DeukPackAST) => string;
  getEnumFullName: (enumDef: DeukPackEnum, ast: DeukPackAST) => string;
  wireProfileSubsetFullNames?: Set<string>;
  wireProfileStructSuffix?: string;
}

const PRIMITIVES = [
  'bool', 'byte', 'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
  'float', 'double', 'string', 'binary',
  'datetime', 'timestamp', 'date', 'time',
  'decimal', 'numeric'
];

export function isLinkTypedefName(typeName: string): boolean {
  const lower = typeName.toLowerCase();
  return lower.startsWith('_link_') || lower.startsWith('_linktid_');
}

export function isPrimitiveTypeName(typeName: string): boolean {
  return PRIMITIVES.includes(typeName);
}

export function csharpGlobalQualifiedIfCrossNamespace(dottedType: string, currentNamespace?: string): string {
  if (!dottedType.includes('.')) return dottedType;
  if (currentNamespace && dottedType.startsWith(currentNamespace + '.')) return dottedType;
  return `global::${dottedType}`;
}

export function getCSharpType(type: DeukPackType, ctx: TypeContext): string {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool': return 'bool';
      case 'byte': return 'byte';
      case 'int8': return 'sbyte';
      case 'int16': return 'short';
      case 'int32': return 'int';
      case 'int64': return 'long';
      case 'uint8': return 'byte';
      case 'uint16': return 'ushort';
      case 'uint32': return 'uint';
      case 'uint64': return 'ulong';
      case 'float': return 'float';
      case 'double': return 'double';
      case 'string': return 'string';
      case 'binary': return 'byte[]';
      case 'datetime':
      case 'timestamp':
      case 'date': return 'DateTime';
      case 'time': return 'TimeSpan';
      case 'decimal':
      case 'numeric': return 'decimal';
      default: {
        const { ast, currentNamespace, findTypedef, resolveTypeToFullName } = ctx;
        const typedefDef = ast ? findTypedef(ast, type, currentNamespace) : null;
        if (typedefDef) return getCSharpType(typedefDef.type, ctx);
        if (isLinkTypedefName(type)) return 'long';
        const fullName = ast ? resolveTypeToFullName(type, currentNamespace, ast) : type;
        if (isPrimitiveTypeName(fullName)) {
          return getCSharpType(fullName as DeukPackType, ctx);
        }
        const named = renameCSharpTypeIfWireProfileSubset(fullName, ctx);
        return csharpGlobalQualifiedIfCrossNamespace(named, currentNamespace);
      }
    }
  }
  if (typeof type === 'object' && type && (type as any).type) {
    const objType = type as { type: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
    switch (objType.type) {
      case 'list':
      case 'array':
        return `List<${getCSharpType(objType.elementType!, ctx)}>`;
      case 'set':
        return `HashSet<${getCSharpType(objType.elementType!, ctx)}>`;
      case 'map':
        return `Dictionary<${getCSharpType(objType.keyType!, ctx)}, ${getCSharpType(objType.valueType!, ctx)}>`;
      case 'tablelink':
        return 'long';
      default:
        return 'object';
    }
  }
  return 'object';
}

export function renameCSharpTypeIfWireProfileSubset(fullName: string, ctx: TypeContext): string {
  const { wireProfileSubsetFullNames, wireProfileStructSuffix } = ctx;
  if (!wireProfileSubsetFullNames || !wireProfileStructSuffix) return fullName;
  if (!wireProfileSubsetFullNames.has(fullName)) return fullName;
  const parts = fullName.split('.');
  const shortName = parts.pop() ?? '';
  const ns = parts.join('.');
  return ns ? `${ns}.${shortName}${wireProfileStructSuffix}` : `${shortName}${wireProfileStructSuffix}`;
}

export function getTType(type: DeukPackType, ctx: TypeContext): string {
  const { ast, currentNamespace, findTypedef, findEnumByFullName, resolveTypeToFullName } = ctx;
  
  if (typeof type === 'string') {
    const typedefDef = ast ? findTypedef(ast, type, currentNamespace) : null;
    if (typedefDef) return getTType(typedefDef.type, ctx);
    if (isLinkTypedefName(type)) return 'DpWireType.Int64';
    
    switch (type) {
      case 'bool': return 'DpWireType.Bool';
      case 'byte':
      case 'int8':
      case 'uint8': return 'DpWireType.Byte';
      case 'int16':
      case 'uint16': return 'DpWireType.Int16';
      case 'int32':
      case 'uint32': return 'DpWireType.Int32';
      case 'int64':
      case 'uint64': return 'DpWireType.Int64';
      case 'float':
      case 'double': return 'DpWireType.Double';
      case 'string': return 'DpWireType.String';
      case 'binary': return 'DpWireType.String';
      case 'datetime':
      case 'timestamp':
      case 'date':
      case 'time': return 'DpWireType.Int64';
      case 'decimal':
      case 'numeric': return 'DpWireType.String';
      default: {
        if (ast) {
          const fullName = resolveTypeToFullName(type, currentNamespace, ast);
          const enumDef = findEnumByFullName(ast, fullName, currentNamespace);
          if (enumDef) return 'DpWireType.Int32';
        }
        return 'DpWireType.Struct';
      }
    }
  }
  if (typeof type === 'object' && type && (type as any).type) {
    const objType = type as { type: string };
    switch (objType.type) {
      case 'list':
      case 'array':
        return 'DpWireType.List';
      case 'set': return 'DpWireType.Set';
      case 'map': return 'DpWireType.Map';
      case 'tablelink': return 'DpWireType.Int64';
      default: return 'DpWireType.Struct';
    }
  }
  return 'DpWireType.Struct';
}

export function getResolvedWireTypeString(type: DeukPackType, ctx: TypeContext): string {
  const { ast, currentNamespace, findTypedef } = ctx;
  if (typeof type !== 'string') {
    return typeof type === 'object' && (type as any)?.type ? (type as any).type : 'record';
  }
  const typedefDef = ast ? findTypedef(ast, type, currentNamespace) : null;
  if (typedefDef) {
    const inner = typedefDef.type;
    if (typeof inner === 'string') return getResolvedWireTypeString(inner, ctx);
  }
  if (isLinkTypedefName(type)) return 'int64';
  return type;
}

export function isEnumType(type: string, ctx: TypeContext): boolean {
  const { ast, currentNamespace, findEnumByFullName, resolveTypeToFullName } = ctx;
  if (!ast) return false;
  const fullName = resolveTypeToFullName(type, currentNamespace, ast);
  return !!findEnumByFullName(ast, fullName, currentNamespace);
}

export function isStructType(type: string, ctx: TypeContext): boolean {
  const { ast, currentNamespace, findStruct, resolveTypeToFullName } = ctx;
  if (!ast) return false;
  const fullName = resolveTypeToFullName(type, currentNamespace, ast);
  return !!findStruct(ast, fullName, currentNamespace);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
