/**
 * Embedded struct schema object for JS Path B, TS pack helpers, etc.
 * fields[].type / typeName: **DeukPack IDL tokens** (not Thrift-style I16/I32/Bool).
 */

import type { DeukPackAST, DeukPackField, DeukPackStruct, DeukPackType } from '../types/DeukPackTypes';

function toDeukPackSchemaTypeName(primitiveToken: string): string {
  const t = primitiveToken.trim();
  const legacy: Record<string, string> = {
    i8: 'int8',
    i16: 'int16',
    i32: 'int32',
    i64: 'int64',
  };
  return legacy[t] ?? t;
}

/** type + typeName both use DeukPack spelling; `type` is the field kind for runtime dispatch. */
function deukPackPrimitiveSchema(lk: string): { type: string; typeName: string } | null {
  const row = (ty: string, tn: string) => ({ type: ty, typeName: tn });
  const m: Record<string, { type: string; typeName: string }> = {
    bool: row('bool', 'bool'),
    tf: row('bool', 'bool'),
    byte: row('byte', 'byte'),
    i8: row('int8', toDeukPackSchemaTypeName('i8')),
    int8: row('int8', 'int8'),
    i16: row('int16', toDeukPackSchemaTypeName('i16')),
    int16: row('int16', 'int16'),
    i32: row('int32', toDeukPackSchemaTypeName('i32')),
    int32: row('int32', 'int32'),
    i64: row('int64', toDeukPackSchemaTypeName('i64')),
    int64: row('int64', 'int64'),
    float: row('float', 'float'),
    double: row('double', 'double'),
    dbl: row('double', 'double'),
    string: row('string', 'string'),
    str: row('string', 'string'),
    binary: row('binary', 'binary'),
    datetime: row('datetime', 'datetime'),
    timestamp: row('timestamp', 'timestamp'),
    date: row('date', 'date'),
    time: row('time', 'time'),
    decimal: row('decimal', 'decimal'),
    numeric: row('numeric', 'numeric'),
  };
  return m[lk] ?? null;
}

export function getEmbeddedSchemaTypeInfo(
  fieldType: DeukPackType | string | undefined,
  ast: DeukPackAST
): { type: string; typeName: string } {
  if (typeof fieldType === 'string') {
    const key = fieldType.trim();
    const lk = key.toLowerCase();
    const prim = deukPackPrimitiveSchema(lk);
    if (prim) return prim;

    if (ast.enums?.length) {
      const hit = ast.enums.find((e) => e.name === key || e.name.endsWith('.' + key));
      if (hit) return { type: 'enum', typeName: hit.name };
    }
    return { type: 'struct', typeName: key };
  }
  if (fieldType && typeof fieldType === 'object') {
    const o = fieldType as {
      type?: string;
      elementType?: DeukPackType;
      keyType?: DeukPackType;
      valueType?: DeukPackType;
    };
    if (o.type === 'list') {
      const elem = getEmbeddedSchemaTypeInfo(o.elementType, ast);
      return { type: 'list', typeName: `list<${elem.typeName}>` };
    }
    if (o.type === 'set') {
      const elem = getEmbeddedSchemaTypeInfo(o.elementType, ast);
      return { type: 'set', typeName: `set<${elem.typeName}>` };
    }
    if (o.type === 'map') {
      const k = getEmbeddedSchemaTypeInfo(o.keyType, ast);
      const v = getEmbeddedSchemaTypeInfo(o.valueType, ast);
      return { type: 'map', typeName: `map<${k.typeName},${v.typeName}>` };
    }
    if (o.type === 'tablelink') {
      const tl = fieldType as { tableCategory: string; keyField: string };
      return {
        type: 'tablelink',
        typeName: `tablelink<${tl.tableCategory},${tl.keyField}>`,
      };
    }
  }
  return { type: 'struct', typeName: 'object' };
}

export function buildEmbeddedFieldsObject(fields: DeukPackField[], ast: DeukPackAST): Record<string, unknown> {
  const fieldsObj: Record<string, unknown> = {};
  for (const field of fields) {
    const ti = getEmbeddedSchemaTypeInfo(field.type, ast);
    fieldsObj[field.id] = {
      id: field.id,
      name: field.name,
      type: ti.type,
      typeName: ti.typeName,
      required: !!field.required,
      defaultValue: field.defaultValue !== undefined ? field.defaultValue : null,
      docComment: field.docComment != null ? field.docComment : undefined,
      annotations: field.annotations && Object.keys(field.annotations).length ? field.annotations : undefined,
    };
  }
  return fieldsObj;
}

export function buildEmbeddedStructSchema(struct: DeukPackStruct, ast: DeukPackAST): Record<string, unknown> {
  return {
    name: struct.name,
    type: 'Struct',
    fields: buildEmbeddedFieldsObject(struct.fields || [], ast),
    docComment: struct.docComment != null ? struct.docComment : undefined,
    annotations: struct.annotations && Object.keys(struct.annotations).length ? struct.annotations : undefined,
  };
}
