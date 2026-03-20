/**
 * Excel (.xlsx) schema round-trip: first row = headers ↔ DeukPack AST.
 * Optional dependency: xlsx (SheetJS). Install for Excel support.
 */

import * as path from 'path';
import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackField,
  DeukPackNamespace,
} from '../types/DeukPackTypes';

const NS_IMPORTED = 'Imported';

function loadXlsx(): { readFile: (p: string, o?: any) => any; utils: any; writeFile: (w: any, p: string) => void } {
  try {
    return require('xlsx');
  } catch {
    throw new Error('Excel support requires the xlsx package. Run: npm install xlsx');
  }
}

/**
 * Parse Excel file: first row of first sheet = column names.
 */
export function parseExcelFileToAst(filePath: string, sourceFile?: string): DeukPackAST {
  const xlsx = loadXlsx();
  const workbook = xlsx.readFile(filePath, { sheetRows: 2 });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return {
      namespaces: [{ language: '*', name: NS_IMPORTED, sourceFile: filePath }],
      structs: [],
      enums: [],
      services: [],
      typedefs: [],
      constants: [],
      includes: [],
      fileNamespaceMap: { [filePath]: NS_IMPORTED },
    };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerRow = Array.isArray(rows?.[0]) ? (rows[0] as unknown[]) : [];
  const headers = headerRow.map((c) => String(c ?? '').trim()).filter((c) => c.length > 0);
  const fields: DeukPackField[] = headers.map((name, i) => ({
    id: i + 1,
    name: name || `col${i + 1}`,
    type: 'string',
    required: false,
  }));
  const base = path.basename(filePath, path.extname(filePath));
  const safeName = base.replace(/[^a-zA-Z0-9_]/g, '_') || 'Sheet';
  const struct: DeukPackStruct = {
    name: safeName,
    fields,
    sourceFile: sourceFile ?? filePath,
  };
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
 * Emit Excel file with one sheet; first row = struct field names.
 */
export function emitExcelFromStruct(struct: DeukPackStruct, outputPath: string): void {
  const xlsx = loadXlsx();
  const headers = (struct.fields || []).map((f) => f.name);
  const ws = xlsx.utils.aoa_to_sheet([headers]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, struct.name.slice(0, 31));
  xlsx.writeFile(wb, outputPath);
}
