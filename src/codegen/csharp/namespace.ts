/**
 * C# namespace resolution utilities
 */

import { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackService, DeukPackTypedef, DeukPackConstant } from '../../types/DeukPackTypes';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function findNamespaceFromSourceFile(sourceFile: string | undefined, ast: DeukPackAST): string | null {
  if (!sourceFile) return null;
  
  if (ast.fileNamespaceMap) {
    const direct = ast.fileNamespaceMap[sourceFile];
    if (direct) return direct;
    
    const normalized = normalizePath(sourceFile);
    const entry = Object.entries(ast.fileNamespaceMap).find(([k]) => normalizePath(k) === normalized);
    if (entry) return entry[1];
  }
  
  const ns = ast.namespaces.find(ns =>
    (ns.language === '*' || ns.language === 'csharp') &&
    ns.sourceFile && normalizePath(ns.sourceFile) === normalizePath(sourceFile)
  );
  if (ns) return ns.name;
  
  return null;
}

function getDefaultNamespace(ast: DeukPackAST): string {
  const ns = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
  return ns?.name ?? 'Generated';
}

export function getEnumNamespace(enumDef: DeukPackEnum, ast: DeukPackAST): string {
  return findNamespaceFromSourceFile(enumDef.sourceFile, ast) ?? getDefaultNamespace(ast);
}

export function getStructNamespace(struct: DeukPackStruct, ast: DeukPackAST): string {
  return findNamespaceFromSourceFile(struct.sourceFile, ast) ?? getDefaultNamespace(ast);
}

export function getTypedefNamespace(typedef: DeukPackTypedef, ast: DeukPackAST): string {
  return findNamespaceFromSourceFile(typedef.sourceFile, ast) ?? getDefaultNamespace(ast);
}

export function getConstantNamespace(constant: DeukPackConstant, ast: DeukPackAST): string {
  return findNamespaceFromSourceFile(constant.sourceFile, ast) ?? getDefaultNamespace(ast);
}

export function getServiceNamespace(service: DeukPackService, ast: DeukPackAST): string {
  return findNamespaceFromSourceFile(service.sourceFile, ast) ?? getDefaultNamespace(ast);
}

export function getStructFullName(struct: DeukPackStruct, ast: DeukPackAST): string {
  const ns = getStructNamespace(struct, ast);
  return `${ns}.${struct.name}`;
}

export function getEnumFullName(enumDef: DeukPackEnum, ast: DeukPackAST): string {
  const ns = getEnumNamespace(enumDef, ast);
  return `${ns}.${enumDef.name}`;
}

export function getTypedefFullName(typedef: DeukPackTypedef, ast: DeukPackAST): string {
  const ns = getTypedefNamespace(typedef, ast);
  return `${ns}.${typedef.name}`;
}

export interface NamespaceGroup {
  enums: DeukPackEnum[];
  structs: DeukPackStruct[];
  typedefs: DeukPackTypedef[];
  constants: DeukPackConstant[];
  services: DeukPackService[];
}

export function groupByNamespace(
  ast: DeukPackAST & { services?: DeukPackService[] }
): Record<string, NamespaceGroup> {
  const groups: Record<string, NamespaceGroup> = {};
  
  const namespaces = ast.namespaces.map(ns => ns.name);
  if (namespaces.length === 0) namespaces.push('Generated');
  
  for (const ns of namespaces) {
    groups[ns] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
  }
  
  for (const enumDef of ast.enums) {
    const ns = getEnumNamespace(enumDef, ast);
    if (groups[ns]) groups[ns].enums.push(enumDef);
  }
  
  for (const struct of ast.structs) {
    const ns = getStructNamespace(struct, ast);
    if (groups[ns]) groups[ns].structs.push(struct);
  }
  
  for (const typedef of ast.typedefs) {
    const ns = getTypedefNamespace(typedef, ast);
    if (groups[ns]) groups[ns].typedefs.push(typedef);
  }
  
  for (const constant of ast.constants) {
    const ns = getConstantNamespace(constant, ast);
    if (groups[ns]) groups[ns].constants.push(constant);
  }
  
  for (const service of ast.services ?? []) {
    const ns = getServiceNamespace(service, ast);
    if (groups[ns]) groups[ns].services.push(service);
  }
  
  return groups;
}

export interface SourceFileGroup {
  enums: DeukPackEnum[];
  structs: DeukPackStruct[];
  typedefs: DeukPackTypedef[];
  constants: DeukPackConstant[];
  services: DeukPackService[];
}

export function groupBySourceFile(ast: DeukPackAST): Record<string, SourceFileGroup> {
  const groups: Record<string, SourceFileGroup> = {};
  
  const ensure = (sourceFile: string) => {
    if (!groups[sourceFile]) {
      groups[sourceFile] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
    }
  };
  
  for (const enumDef of ast.enums) {
    const sf = enumDef.sourceFile || 'unknown';
    ensure(sf);
    groups[sf]!.enums.push(enumDef);
  }
  
  for (const struct of ast.structs) {
    const sf = struct.sourceFile || 'unknown';
    ensure(sf);
    groups[sf]!.structs.push(struct);
  }
  
  for (const typedef of ast.typedefs) {
    const sf = typedef.sourceFile || 'unknown';
    ensure(sf);
    groups[sf]!.typedefs.push(typedef);
  }
  
  for (const constant of ast.constants) {
    const sf = constant.sourceFile || 'unknown';
    ensure(sf);
    groups[sf]!.constants.push(constant);
  }
  
  for (const service of ast.services) {
    const sf = service.sourceFile || 'unknown';
    ensure(sf);
    groups[sf]!.services.push(service);
  }
  
  return groups;
}

export function resolveTypeToFullName(
  typeStr: string,
  currentNamespace: string | undefined,
  ast: DeukPackAST
): string {
  if (!typeStr || typeof typeStr !== 'string') return typeStr;
  
  const primitives = [
    'bool', 'byte', 'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'double', 'string', 'binary',
    'datetime', 'timestamp', 'date', 'time',
    'decimal', 'numeric'
  ];
  if (primitives.includes(typeStr)) return typeStr;
  
  if (typeStr.includes('.')) {
    for (const s of ast.structs ?? []) {
      if (getStructFullName(s, ast) === typeStr) return typeStr;
    }
    for (const e of ast.enums ?? []) {
      if (getEnumFullName(e, ast) === typeStr) return typeStr;
    }
    for (const t of ast.typedefs ?? []) {
      if (getTypedefFullName(t, ast) === typeStr) return typeStr;
    }
    return typeStr;
  }
  
  const sameNs = currentNamespace ? `${currentNamespace}.${typeStr}` : '';
  if (sameNs) {
    for (const s of ast.structs ?? []) {
      if (getStructFullName(s, ast) === sameNs) return sameNs;
    }
    for (const e of ast.enums ?? []) {
      if (getEnumFullName(e, ast) === sameNs) return sameNs;
    }
    for (const t of ast.typedefs ?? []) {
      if (getTypedefFullName(t, ast) === sameNs) return sameNs;
    }
  }
  
  const matches: string[] = [];
  for (const s of ast.structs ?? []) {
    const full = getStructFullName(s, ast);
    if (full.endsWith('.' + typeStr)) matches.push(full);
  }
  for (const e of ast.enums ?? []) {
    const full = getEnumFullName(e, ast);
    if (full.endsWith('.' + typeStr)) matches.push(full);
  }
  for (const t of ast.typedefs ?? []) {
    const full = getTypedefFullName(t, ast);
    if (full.endsWith('.' + typeStr)) matches.push(full);
  }
  
  if (matches.length === 0) return typeStr;
  if (currentNamespace && matches.some(m => m.startsWith(currentNamespace + '.'))) {
    return matches.find(m => m.startsWith(currentNamespace + '.')) ?? matches[0] ?? typeStr;
  }
  return matches[0] ?? typeStr;
}
