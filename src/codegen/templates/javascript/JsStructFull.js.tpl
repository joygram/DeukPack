const _schema_@@SAFE_NAME@@ = @@SCHEMA_JSON@@;
@@INLINE_BIN@@
@@INLINE_PACK@@

_schema_@@SAFE_NAME@@._readBin = _read_@@SAFE_NAME@@_bin;
_schema_@@SAFE_NAME@@._readPack = _read_@@SAFE_NAME@@_pack;
const @@SAFE_NAME@@ = {
  getSchema() { return _schema_@@SAFE_NAME@@; },
  create() { return {}; },
  pack(obj, format, fieldIds, overrides) {
    if (format === 'json') return JSON.stringify(_toDpJsonFiltered(_schema_@@SAFE_NAME@@, obj, _schemas, fieldIds, overrides));
    return _structToPackBinaryFiltered(_schema_@@SAFE_NAME@@, obj, _schemas, fieldIds, overrides);
  },
  /**
   * Deserializes binary data into a JavaScript Object.
   * Can be called as \`unpack(buffer)\` to create a HIGH-PERFORMANCE NEW object (recommended for V8 JS Engines),
   * or \`unpack(existingObj, buffer)\` to mutate an existing object (advanced memory-pooling).
   */
  unpack(a, b, c) {
    let o = null, d, f = 'binary';
    let isBuf = typeof a === 'string' || (a && a.byteLength !== undefined) || (typeof Buffer !== 'undefined' && Buffer.isBuffer(a));
    if (a && typeof a === 'object' && !isBuf) { o = a; d = b; f = c || 'binary'; } else { d = a; f = b || 'binary'; }
    let p = (f === 'json') ? _fromDpJson(_schema_@@SAFE_NAME@@, JSON.parse(d || "{}"), _schemas) : _structFromBinary(_schema_@@SAFE_NAME@@, d, _schemas);
    return o ? Object.assign(o, p) : p;
  },
  // Legacy aliases
  toBinary(obj, fieldIds, overrides) { return this.pack(obj, fieldIds, overrides); },
  fromBinary(buf) { return this.unpack(buf); },
  fromExcel(sheet, row) { return _fromExcelRow(_schema_@@SAFE_NAME@@, sheet, row, _schemas, _enums); },
  fromExcelSheet(sheet, firstRow) { return _fromExcelSheet(_schema_@@SAFE_NAME@@, sheet, _schemas, _enums, firstRow); },
  FieldId: { @@FIELD_ID_ENTRIES@@ }
};
