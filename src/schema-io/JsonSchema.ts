/**
 * JSON schema round-trip: JSON file (object or array of objects) ↔ DeukPack AST.
 * Keys become field names; types default to string. Field IDs 1,2,3...
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackField,
  DeukPackNamespace,
} from '../types/DeukPackTypes';

const NS_IMPORTED = 'Imported';

/**
 * Parse JSON (object or array); infer one struct from keys.
 */
export function parseJsonToStruct(
  data: unknown,
  structName: string,
  sourceFile: string
): DeukPackStruct | null {
  let keys: string[];
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const first = data[0] as Record<string, unknown>;
    keys = Object.keys(first);
  } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    keys = Object.keys(data as Record<string, unknown>);
  } else {
    return null;
  }
  const fields: DeukPackField[] = keys.map((name, i) => ({
    id: i + 1,
    name,
    type: 'string',
    required: false,
  }));
  return {
    name: structName,
    fields,
    sourceFile,
  };
}

/**
 * Load JSON file and return AST (single struct).
 */
export function parseJsonFileToAst(filePath: string, sourceFile?: string): DeukPackAST {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  const base = path.basename(filePath, path.extname(filePath));
  const safeName = base.replace(/[^a-zA-Z0-9_]/g, '_') || 'JsonTable';
  const struct = parseJsonToStruct(data, safeName, sourceFile ?? filePath);
  const structs = struct ? [struct] : [];
  const ns: DeukPackNamespace = { language: '*', name: NS_IMPORTED, sourceFile: filePath };
  return {
    namespaces: [ns],
    structs,
    enums: [],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: { [filePath]: NS_IMPORTED },
  };
}

/**
 * Emit JSON object with struct field keys and null values (schema shape).
 */
export function emitJsonFromStruct(struct: DeukPackStruct): string {
  const obj: Record<string, null> = {};
  for (const f of struct.fields || []) {
    obj[f.name] = null;
  }
  return JSON.stringify(obj, null, 2);
}
