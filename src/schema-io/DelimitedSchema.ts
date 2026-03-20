/**
 * CSV / PSV schema round-trip: delimited file ↔ DeukPack AST.
 * First row = header (column names → field names). Field IDs 1,2,3...
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

function parseHeaderLine(line: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuoted = !inQuoted;
    } else if (!inQuoted && c === delimiter) {
      parts.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  parts.push(current.trim());
  return parts;
}

function escapeField(name: string): string {
  if (name.includes(',') || name.includes('"') || name.includes('\n')) {
    return '"' + name.replace(/"/g, '""') + '"';
  }
  return name;
}

/**
 * Parse delimited content (CSV or PSV); first line = header.
 */
export function parseDelimitedToStruct(
  content: string,
  delimiter: string,
  structName: string,
  sourceFile: string
): DeukPackStruct {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const firstLine = lines[0];
  const headers = lines.length > 0 && firstLine !== undefined ? parseHeaderLine(firstLine, delimiter) : [];
  const fields: DeukPackField[] = headers.map((name, i) => ({
    id: i + 1,
    name: (name ?? '').trim() || `col${i + 1}`,
    type: 'string' as const,
    required: false,
  }));
  return {
    name: structName,
    fields,
    sourceFile,
  };
}

/**
 * Load delimited file and return AST (single struct).
 */
export function parseDelimitedFileToAst(
  filePath: string,
  delimiter: string,
  sourceFile?: string
): DeukPackAST {
  const content = fs.readFileSync(filePath, 'utf8');
  const base = path.basename(filePath, path.extname(filePath));
  const safeName = base.replace(/[^a-zA-Z0-9_]/g, '_') || 'Table';
  const struct = parseDelimitedToStruct(content, delimiter, safeName, sourceFile ?? filePath);
  const ns: DeukPackNamespace = { language: '*', name: NS_IMPORTED, sourceFile: filePath };
  return {
    namespaces: [ns],
    structs: [struct],
    enums: [],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: { [filePath]: NS_IMPORTED },
  };
}

/**
 * Emit delimited content (header row only, or header + empty row for schema).
 */
export function emitDelimitedFromStruct(struct: DeukPackStruct, delimiter: string): string {
  const names = (struct.fields || []).map((f) => escapeField(f.name));
  return names.join(delimiter) + '\n';
}
