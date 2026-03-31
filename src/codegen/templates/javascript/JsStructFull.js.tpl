const _schema_@@SAFE_NAME@@ = @@SCHEMA_JSON@@;
@@INLINE_BIN@@
@@INLINE_PACK@@

_schema_@@SAFE_NAME@@._readBin = _read_@@SAFE_NAME@@_bin;
_schema_@@SAFE_NAME@@._readPack = _read_@@SAFE_NAME@@_pack;
const @@SAFE_NAME@@ = {
  getSchema() { return _schema_@@SAFE_NAME@@; },
  create() { return {}; },
  toJson(obj, fieldIds, overrides) { return JSON.stringify(_toDpJsonFiltered(_schema_@@SAFE_NAME@@, obj, _schemas, fieldIds, overrides)); },
  fromJson(str) { return _fromDpJson(_schema_@@SAFE_NAME@@, JSON.parse(str || "{}"), _schemas); },
  toBinary(obj, fieldIds, overrides) { return _structToPackBinaryFiltered(_schema_@@SAFE_NAME@@, obj, _schemas, fieldIds, overrides); },
  fromBinary(buf) { return _structFromPackBinary(_schema_@@SAFE_NAME@@, buf, _schemas); },
  fromExcel(sheet, row) { return _fromExcelRow(_schema_@@SAFE_NAME@@, sheet, row, _schemas, _enums); },
  fromExcelSheet(sheet, firstRow) { return _fromExcelSheet(_schema_@@SAFE_NAME@@, sheet, _schemas, _enums, firstRow); },
  FieldId: { @@FIELD_ID_ENTRIES@@ }
};
