// wire profile "@@PROFILE@@" subset
const _schema_@@SUBSET_EXPORT_NAME@@ = @@SCHEMA_JSON@@;
@@INLINE_BIN@@
@@INLINE_PACK@@

_schema_@@SUBSET_EXPORT_NAME@@._readBin = _read_@@SUBSET_EXPORT_NAME@@_bin;
_schema_@@SUBSET_EXPORT_NAME@@._readPack = _read_@@SUBSET_EXPORT_NAME@@_pack;
const @@SUBSET_EXPORT_NAME@@ = {
  getSchema() { return _schema_@@SUBSET_EXPORT_NAME@@; },
  create() { return {}; },
  toJson(obj) { return JSON.stringify(_toDpJson(_schema_@@SUBSET_EXPORT_NAME@@, obj, _schemas)); },
  fromJson(str) { return _fromDpJson(_schema_@@SUBSET_EXPORT_NAME@@, JSON.parse(str || "{}"), _schemas); },
  toBinary(obj) { return _structToPackBinary(_schema_@@SUBSET_EXPORT_NAME@@, obj, _schemas); },
  fromBinary(buf) { return _structFromPackBinary(_schema_@@SUBSET_EXPORT_NAME@@, buf, _schemas); },
  fromExcel(sheet, row) { return _fromExcelRow(_schema_@@SUBSET_EXPORT_NAME@@, sheet, row, _schemas, _enums); },
  fromExcelSheet(sheet, firstRow) { return _fromExcelSheet(_schema_@@SUBSET_EXPORT_NAME@@, sheet, _schemas, _enums, firstRow); }
};
