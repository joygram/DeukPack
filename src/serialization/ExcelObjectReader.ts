/**
 * DeukPack Excel Schema-driven Object Reader
 *
 * Provides functions to read plain JS objects from Excel sheets based on a JSON schema,
 * separate from the DpProtocol streaming implementation.
 */

import { IExcelSheet, FIRST_DATA_ROW, HIERARCHY_ID_ROW, DATATYPE_ROW } from '../protocols/ExcelUtils';

export interface ColMapEntry {
  col: number;
  datatype: string;
}

/**
 * Schema-driven Excel reader for plain JS objects.
 */
export function fromExcelRow(
  schema: any,
  sheet: IExcelSheet,
  row: number,
  schemas: Record<string, any>,
  enumMap?: Record<string, any>
): Record<string, any> {
  if (!schema || (schema.type !== 'struct' && schema.type !== 'Struct') || !schema.fields) return {};

  const colMap = buildColMap(sheet);
  const result: Record<string, any> = {};

  const fields = schema.fields as Record<string, any>;
  for (const fid of Object.keys(fields)) {
    const field = fields[fid] as Record<string, any>;
    const val = readFieldValue(field, fid, colMap, sheet, row, schemas, enumMap, '');
    if (val !== undefined && val !== null) {
      result[field['name'] as string] = val;
    }
  }
  return result;
}

/**
 * Read all records from an Excel sheet.
 */
export function fromExcelSheet(
  schema: any,
  sheet: IExcelSheet,
  schemas: Record<string, any>,
  enumMap?: Record<string, any>,
  firstDataRow: number = FIRST_DATA_ROW
): Map<number, Record<string, any>> {
  const result = new Map<number, Record<string, any>>();

  for (let row = firstDataRow; row <= sheet.lastRow; row++) {
    const metaIdStr = sheet.cellValue(row, 1);
    if (!metaIdStr) continue;
    const metaId = parseInt(metaIdStr.split(':')[0]!.trim(), 10);
    if (isNaN(metaId)) continue;

    const obj = fromExcelRow(schema, sheet, row, schemas, enumMap);
    result.set(metaId, obj);
  }
  return result;
}

function buildColMap(sheet: IExcelSheet): Map<string, ColMapEntry> {
  const map = new Map<string, ColMapEntry>();
  for (let col = 1; col <= sheet.lastColumn; col++) {
    const hier = sheet.cellValue(HIERARCHY_ID_ROW, col)?.trim();
    if (!hier) break;
    const dt = sheet.cellValue(DATATYPE_ROW, col)?.trim() ?? '';
    map.set(hier, { col, datatype: dt });
  }
  return map;
}

function readFieldValue(
  field: Record<string, any>, fieldId: string,
  colMap: Map<string, ColMapEntry>,
  sheet: IExcelSheet, row: number,
  schemas: Record<string, any>,
  enumMap: Record<string, any> | undefined,
  parentPath: string
): any {
  const fieldPath = parentPath ? parentPath + '.' + fieldId : fieldId;
  const type = field['type'] as string;
  const typeName = field['typeName'] as string;

  if (type === 'struct' || type === 'Struct') {
    const childSchema = schemas[typeName] as Record<string, any> | undefined;
    if (!childSchema?.['fields']) return undefined;
    const obj: Record<string, any> = {};
    let hasData = false;
    const childFields = childSchema['fields'] as Record<string, any>;
    for (const cid of Object.keys(childFields)) {
      const cf = childFields[cid] as Record<string, any>;
      const val = readFieldValue(cf, cid, colMap, sheet, row, schemas, enumMap, fieldPath);
      if (val !== undefined && val !== null) { obj[cf['name'] as string] = val; hasData = true; }
    }
    return hasData ? obj : undefined;
  }

  if (type === 'list' || type === 'set' || type === 'List' || type === 'Set') {
    return readListValue(fieldPath, typeName, colMap, sheet, row, schemas, enumMap);
  }

  const entry = colMap.get(fieldPath);
  if (!entry) return undefined;
  if (sheet.isCellEmpty(row, entry.col)) return undefined;

  const raw = sheet.cellValue(row, entry.col) ?? '';
  return parsePrimitiveValue(type, raw, entry.datatype, enumMap);
}

function readListValue(
  listPath: string, typeName: string,
  colMap: Map<string, ColMapEntry>,
  sheet: IExcelSheet, row: number,
  schemas: Record<string, any>,
  enumMap: Record<string, any> | undefined
): any[] | undefined {
  const prefix = listPath + '.';
  const metaId = sheet.cellValue(row, 1) ?? '';

  let count = 0;
  for (let r = row; r <= sheet.lastRow; r++) {
    if (r > row) {
      const rid = sheet.cellValue(r, 1) ?? '';
      if (rid && rid !== metaId) break;
    }
    let hasData = false;
    for (const [p, e] of colMap) {
      if ((p === listPath || p.startsWith(prefix)) && !sheet.isCellEmpty(r, e.col)) {
        hasData = true; break;
      }
    }
    if (hasData) count++;
    else if (count > 0) break;
  }
  if (count === 0) return undefined;

  const arrayMatch = typeName.match(/^array<([^,>]+),\s*\d+>$/i);
  const listSetMatch = typeName.match(/^(?:list|set)<(.+)>$/i);
  const elemTypeName = arrayMatch
    ? arrayMatch[1]!.trim()
    : listSetMatch
      ? listSetMatch[1]!.trim()
      : (typeName && typeName.trim()) || 'record';
  const primitiveTypes = ['int32', 'int64', 'int16', 'int8', 'float', 'double', 'string', 'bool', 'byte'];
  const elemIsPrimitive = primitiveTypes.includes(elemTypeName);

  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const elemRow = row + i;
    if (elemIsPrimitive) {
      for (const [p, e] of colMap) {
        if (p.startsWith(prefix)) {
          const raw = sheet.cellValue(elemRow, e.col) ?? '';
          result.push(parsePrimitiveValue(mapSchemaTypeToWire(elemTypeName), raw, e.datatype, enumMap));
          break;
        }
      }
    } else {
      const elemSchema = schemas[elemTypeName] as Record<string, any> | undefined;
      if (elemSchema?.['fields']) {
        const obj: Record<string, any> = {};
        const childFields = elemSchema['fields'] as Record<string, any>;
        for (const cid of Object.keys(childFields)) {
          const cf = childFields[cid] as Record<string, any>;
          const val = readFieldValue(cf, cid, colMap, sheet, elemRow, schemas, enumMap, listPath);
          if (val !== undefined && val !== null) obj[cf['name'] as string] = val;
        }
        result.push(obj);
      } else {
        const obj: Record<string, any> = {};
        for (const [p, e] of colMap) {
          if (!p.startsWith(prefix)) continue;
          const remainder = p.substring(prefix.length);
          if (remainder.includes('.')) continue;
          if (!sheet.isCellEmpty(elemRow, e.col)) {
            obj[remainder] = sheet.cellValue(elemRow, e.col);
          }
        }
        result.push(obj);
      }
    }
  }
  return result.length > 0 ? result : undefined;
}

function parsePrimitiveValue(
  type: string, raw: string, datatype: string,
  enumMap: Record<string, any> | undefined
): any {
  if (!raw && raw !== '0') return type === 'string' ? '' : undefined;
  const token = raw.split(':')[0]!.trim();
  switch (type) {
    case 'bool': case 'Bool': return token === '1' || token.toLowerCase() === 'true';
    case 'byte': case 'Byte': case 'int16': case 'I16': case 'int32': case 'I32': {
      const n = parseInt(token, 10);
      if (!isNaN(n)) return n;
      if (enumMap && datatype.startsWith('enum')) {
        const enumTypeName = extractContainerElemType(datatype);
        const enumDef = enumMap[enumTypeName] as Record<string, any> | undefined;
        const values = enumDef?.['values'] as Record<string, number> | undefined;
        if (values) {
          const v = values[token];
          if (v !== undefined) return v;
        }
      }
      return 0;
    }
    case 'int64': case 'I64': return parseInt(token, 10) || 0;
    case 'double': case 'Double': return parseFloat(raw) || 0;
    case 'string': case 'String': return raw.trim();
    default: return raw.trim();
  }
}

function mapSchemaTypeToWire(tn: string): string {
  const m: Record<string, string> = {
    'int32': 'int32', 'int64': 'int64', 'int16': 'int16', 'int8': 'byte',
    'byte': 'byte', 'float': 'double',
    'double': 'double', 'dbl': 'double', 'string': 'string', 'str': 'string',
    'bool': 'bool', 'tf': 'bool'
  };
  return m[tn] ?? 'struct';
}

function extractContainerElemType(dt: string): string {
  const lt = dt.indexOf('<');
  const gt = dt.lastIndexOf('>');
  if (lt >= 0 && gt > lt) return dt.substring(lt + 1, gt).trim();
  return 'record';
}
