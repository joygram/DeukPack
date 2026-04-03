// wire profile "@@PROFILE@@" subset
const _schema_@@SUBSET_EXPORT_NAME@@ = @@SCHEMA_JSON@@;
@@INLINE_BIN@@
@@INLINE_PACK@@

_schema_@@SUBSET_EXPORT_NAME@@._readBin = _read_@@SUBSET_EXPORT_NAME@@_bin;
_schema_@@SUBSET_EXPORT_NAME@@._readPack = _read_@@SUBSET_EXPORT_NAME@@_pack;
const @@SUBSET_EXPORT_NAME@@ = {
  getSchema() { return _schema_@@SUBSET_EXPORT_NAME@@; },
  create() { return {}; },
  pack(obj, format) {
    if (format === 'json') return JSON.stringify(_toDpJson(_schema_@@SUBSET_EXPORT_NAME@@, obj, _schemas));
    return _structToBinary(_schema_@@SUBSET_EXPORT_NAME@@, obj, _schemas);
  },
  unpack(a, b, c) {
    let o = null, d, f = 'binary';
    const isBuf = x => typeof x === 'string' || x instanceof Uint8Array || x instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer(x));
    if (a && typeof a === 'object' && !isBuf(a)) { o = a; d = b; f = c || f; } else { d = a; f = b || f; }
    let p = (f === 'json') ? _fromDpJson(_schema_@@SUBSET_EXPORT_NAME@@, JSON.parse(d || "{}"), _schemas) : _structFromBinary(_schema_@@SUBSET_EXPORT_NAME@@, d, _schemas);
    return o ? Object.assign(o, p) : p;
  },
  // Legacy aliases
  toBinary(obj) { return this.pack(obj); },
  fromBinary(buf) { return this.unpack(buf); },
  fromExcel(sheet, row) { return _fromExcelRow(_schema_@@SUBSET_EXPORT_NAME@@, sheet, row, _schemas, _enums); },
  fromExcelSheet(sheet, firstRow) { return _fromExcelSheet(_schema_@@SUBSET_EXPORT_NAME@@, sheet, _schemas, _enums, firstRow); }
};
