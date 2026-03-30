/**
 * DeukPack Excel Protocol Utilities & Constants
 */

import { DpWireType } from './WireProtocol';

export interface IExcelSheet {
  cellValue(row: number, col: number): string | null;
  isCellEmpty(row: number, col: number): boolean;
  readonly lastColumn: number;
  readonly lastRow: number;
}

export const HIERARCHY_ID_ROW = 1;
export const DATATYPE_ROW = 2;
export const COLUMN_NAME_ROW = 3;
export const FIRST_DATA_ROW = 5;

export function dataTypeToDpWireType(dt: string): DpWireType {
  if (!dt) return DpWireType.String;
  const lower = dt.toLowerCase();
  if (lower === 'int64' || lower === 'i64') return DpWireType.Int64;
  if (lower === 'int32' || lower === 'i32') return DpWireType.Int32;
  if (lower === 'int16' || lower === 'i16') return DpWireType.Int16;
  if (lower === 'int8' || lower === 'i8') return DpWireType.Byte;
  if (lower === 'float') return DpWireType.Double;
  if (lower === 'str') return DpWireType.String;
  if (lower === 'dbl') return DpWireType.Double;
  if (lower === 'tf') return DpWireType.Bool;
  if (lower === 'rec' || lower === 'record') return DpWireType.Struct;
  if (lower.startsWith('lst') || lower.startsWith('list') || lower.startsWith('array')) return DpWireType.List;
  if (lower.startsWith('set')) return DpWireType.Set;
  if (lower.startsWith('map')) return DpWireType.Map;
  if (lower.startsWith('enum')) return DpWireType.Int32;
  return DpWireType.String;
}

export function extractContainerElemType(dt: string): string {
  const lt = dt.indexOf('<');
  const gt = dt.lastIndexOf('>');
  if (lt >= 0 && gt > lt) return dt.substring(lt + 1, gt).trim();
  return 'record';
}
