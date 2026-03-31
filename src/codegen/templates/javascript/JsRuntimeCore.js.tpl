// --- Protocol runtime: DeukPack JSON on the wire (compatibility protocol; do not rename keys) ---
// Field IDs are object keys. Each value is a tagged wrapper: { i32 }, { i64 }, { str }, { lst }, { map }, { rec }, { tf }, { dbl }, …
// Wrapper property names (i32, str, …) are FIXED wire vocabulary — not schema spellings.
// getSchema().fields[].type / typeName: **DeukPack IDL tokens** (int32, bool, list<…>, struct, enum, …) — not Thrift-style I32/Bool.
function _deukSerializationWarn(kind, structName, fieldNameOrId, fieldId) {
  try {
    if (typeof console !== 'undefined' && console.warn) {
      var msg = kind === 'unknown' ? 'Unknown field' : 'Missing required field';
      console.warn('[DeukPack] ' + msg + ': struct=' + structName + (fieldNameOrId != null ? ', field=' + fieldNameOrId : '') + (fieldId != null ? ', fieldId=' + fieldId : ''));
    }
  } catch (e) {}
}
function _wrapDpJson(type, typeName, val, schemas) {
  if (val === null || val === undefined) return null;
  switch (type) {
    case "bool": return { tf: !!val };
    case "int8":
    case "byte":
    case "int16":
    case "int32":
    case "date":
    case "time":
      return { i32: Number(val) };
    case "int64":
    case "datetime":
    case "timestamp":
    case "tablelink":
      return { i64: String(val) };
    case "float":
    case "double":
      return { dbl: Number(val) };
    case "enum":
      return { i32: Number(val) };
    case "string":
      return { str: String(val) };
    case "binary":
      if (typeof Buffer !== "undefined") return { str: Buffer.from(val).toString("base64") };
      var arr = val && val.length != null ? val : []; var s = ""; for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i] & 255); return { str: (typeof btoa !== "undefined" ? btoa(s) : "") };
    case "decimal":
    case "numeric":
      return { str: String(val) };
    case "list":
    case "set":
      var elem = (typeName.match(/^(?:list|set)<(.+)>$/i) || [])[1];
      elem = elem ? elem.trim() : "";
      return { lst: (val || []).map(function(e) { return _wrapDpJson(_elemType(elem), elem, e, schemas); }) };
    case "map":
      var m = (typeName.match(/^map<([^,]+),(.+)>$/i) || []);
      var out = {};
      for (var k in val) if (Object.prototype.hasOwnProperty.call(val, k)) { var mv = m[2] ? m[2].trim() : ""; out[String(k)] = _wrapDpJson(_elemType(mv), mv, val[k], schemas); }
      return { map: out };
    default:
      var s = schemas && schemas[typeName];
      return s ? _toDpJson(s, val, schemas) : { str: String(val) };
  }
}
function _elemType(tn) {
  if (!tn) return "string";
  var raw = String(tn).trim();
  var m = raw.match(/^(?:list|set)<(.+)>$/i);
  if (m) return _elemType(m[1].trim());
  if (/^tablelink\s*</i.test(raw)) return "int64";
  var x = raw.toLowerCase();
  if (x === "bool" || x === "tf") return "bool";
  if (x === "byte" || x === "int8" || x === "i8") return "int8";
  if (x === "int16" || x === "i16") return "int16";
  if (x === "int32" || x === "i32") return "int32";
  if (x === "int64" || x === "i64") return "int64";
  if (x === "double" || x === "dbl") return "double";
  if (x === "float") return "float";
  if (x === "string" || x === "str") return "string";
  if (x === "binary") return "binary";
  if (x === "datetime") return "datetime";
  if (x === "timestamp") return "timestamp";
  if (x === "date") return "date";
  if (x === "time") return "time";
  if (x === "decimal") return "decimal";
  if (x === "numeric") return "numeric";
  return "struct";
}
function _toDpJson(schema, obj, schemas) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) return obj;
  var out = {};
  for (var id in schema.fields) { var f = schema.fields[id]; var v = obj && obj[f.name]; if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue; if (v !== undefined) out[String(id)] = _wrapDpJson(f.type, f.typeName, v, schemas); }
  return out;
}
function _toDpJsonFiltered(schema, obj, schemas, fieldIds, overrides) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) return obj;
  var idSet = fieldIds ? {} : null;
  if (fieldIds) { for (var i = 0; i < fieldIds.length; i++) idSet[fieldIds[i]] = true; }
  var out = {};
  for (var id in schema.fields) {
    if (idSet && !idSet[id]) continue;
    var f = schema.fields[id];
    var v = (overrides && overrides[id] !== undefined) ? overrides[id] : (obj && obj[f.name]);
    if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue;
    if (v !== undefined) out[String(id)] = _wrapDpJson(f.type, f.typeName, v, schemas);
  }
  return out;
}
// Unwrap: reads wire keys (.i32, .str, …) from the compatibility JSON shape above.
function _unwrapDpJson(type, typeName, jsonVal, schemas) {
  if (jsonVal === null || jsonVal === undefined) return null;
  if (type === "struct" || type === "Struct") {
    var sn = schemas && schemas[typeName];
    return sn ? _fromDpJson(sn, jsonVal, schemas) : jsonVal;
  }
  if (typeof jsonVal === "object" && !Array.isArray(jsonVal)) {
    if (type === "binary" && jsonVal.str) { var b64 = jsonVal.str; if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64")); var bin = typeof atob !== "undefined" ? atob(b64) : ""; var arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; }
    if (jsonVal.str !== undefined) return jsonVal.str;
    if (jsonVal.i32 !== undefined) return jsonVal.i32;
    if (jsonVal.i64 !== undefined) return BigInt(jsonVal.i64);
    if (jsonVal.dbl !== undefined) return jsonVal.dbl;
    if (jsonVal.tf !== undefined) return jsonVal.tf;
    if (jsonVal.lst !== undefined) { var elem = (typeName.match(/^(?:list|set)<(.+)>$/i) || [])[1]; elem = elem ? elem.trim() : ""; return jsonVal.lst.map(function(e) { return _unwrapDpJson(_elemType(elem), elem, e, schemas); }); }
    if (jsonVal.map !== undefined) { var mm = (typeName.match(/^map<([^,]+),(.+)>$/i) || []); var vt = mm[2] ? mm[2].trim() : ""; var o = {}; for (var k in jsonVal.map) o[k] = _unwrapDpJson(_elemType(vt), vt, jsonVal.map[k], schemas); return o; }
    if (jsonVal.rec !== undefined) { var s = schemas && schemas[typeName]; return s ? _fromDpJson(s, jsonVal.rec, schemas) : jsonVal.rec; }
  }
  return jsonVal;
}
function _fromDpJson(schema, jsonObj, schemas) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) return jsonObj || {};
  var structName = (schema && schema.name) ? schema.name : 'Struct';
  if (jsonObj && typeof jsonObj === 'object') {
    for (var k in jsonObj) { if (Object.prototype.hasOwnProperty.call(jsonObj, k) && !schema.fields[k]) _deukSerializationWarn('unknown', structName, k, k); }
  }
  var out = {};
  for (var id in schema.fields) {
    var f = schema.fields[id];
    var w = jsonObj && jsonObj[String(id)];
    if (f.required && w === undefined) _deukSerializationWarn('missing', structName, f.name, id);
    if (w !== undefined) out[f.name] = _unwrapDpJson(f.type, f.typeName, w, schemas);
  }
  return out;
}

// Excel row constants: Row 1=HIERARCHY_ID, Row 2=DATATYPE, Row 5+=DATA
var _XL_HIER_ROW = 1, _XL_DT_ROW = 2, _XL_FIRST_DATA = 5;
function _xlBuildColMap(sheet) {
  var m = {}; for (var c = 1; c <= sheet.lastColumn; c++) { var h = (sheet.cellValue(_XL_HIER_ROW, c) || "").trim(); if (!h) break; m[h] = { col: c, dt: (sheet.cellValue(_XL_DT_ROW, c) || "").trim() }; } return m;
}
function _xlParsePrimitive(type, raw, dt, enums) {
  if (raw === null || raw === undefined || raw === "") return type === "string" ? "" : undefined;
  var tok = String(raw).split(":")[0].trim();
  switch (type) {
    case "bool": return tok === "1" || tok.toLowerCase() === "true";
    case "int8":
    case "byte":
    case "int16":
    case "int32":
    case "date":
    case "time":
      var n = parseInt(tok, 10); if (!isNaN(n)) return n;
      if (enums && dt && dt.indexOf("enum") === 0) { var en = dt.replace(/^enum[<(]|[>)]$/g,""); var ed = enums[en]; if (ed && ed.values && ed.values[tok] !== undefined) return ed.values[tok]; }
      return 0;
    case "int64":
    case "datetime":
    case "timestamp":
    case "tablelink":
      return BigInt(tok) || 0n;
    case "float":
    case "double":
      return parseFloat(raw) || 0;
    case "string":
    case "decimal":
    case "numeric":
      return String(raw).trim();
    default: return String(raw).trim();
  }
}
function _xlMapType(tn) {
  var x = String(tn || "").trim().toLowerCase();
  var m = { i32:"int32", int32:"int32", i64:"int64", int64:"int64", i16:"int16", int16:"int16", i8:"int8", int8:"int8", byte:"byte", double:"double", float:"float", dbl:"double", string:"string", str:"string", bool:"bool", tf:"bool", binary:"binary", datetime:"datetime", timestamp:"timestamp", date:"date", time:"time", decimal:"decimal", numeric:"numeric" };
  return m[x] || "struct";
}
function _xlCountListRows(sheet, row, listPath, colMap) {
  var tuid = sheet.cellValue(row, 1) || "", pfx = listPath + ".", cnt = 0;
  for (var r = row; r <= sheet.lastRow; r++) {
    if (r > row) { var rid = sheet.cellValue(r, 1) || ""; if (rid && rid !== tuid) break; }
    var has = false; for (var p in colMap) { if ((p === listPath || p.indexOf(pfx) === 0) && !sheet.isCellEmpty(r, colMap[p].col)) { has = true; break; } }
    if (has) cnt++; else if (cnt > 0) break;
  } return cnt;
}
function _xlReadField(field, fid, colMap, sheet, row, schemas, enums, parentPath) {
  var fp = parentPath ? parentPath + "." + fid : String(fid);
  var type = field.type, tn = field.typeName;
  if (type === "struct" || type === "Struct") {
    var cs = schemas[tn]; if (!cs || !cs.fields) return undefined;
    var obj = {}, has = false;
    for (var cid in cs.fields) { var cf = cs.fields[cid]; var v = _xlReadField(cf, cid, colMap, sheet, row, schemas, enums, fp); if (v !== undefined && v !== null) { obj[cf.name] = v; has = true; } }
    return has ? obj : undefined;
  }
  if (type === "list" || type === "set" || type === "List" || type === "Set") {
    var cnt = _xlCountListRows(sheet, row, fp, colMap); if (cnt === 0) return undefined;
    var em = (tn.match(/^(?:list|set)<(.+)>$/i) || [])[1] || "struct";
    em = em ? em.trim().toLowerCase() : "struct";
    var isPrim = ["i32","int32","i64","int64","i16","int16","i8","int8","double","float","string","bool","byte","dbl","str","tf","binary","date","time","datetime","timestamp","decimal","numeric","tablelink"].indexOf(em) >= 0;
    var arr = [], pfx = fp + ".";
    for (var i = 0; i < cnt; i++) { var er = row + i;
      if (isPrim) { for (var p in colMap) { if (p.indexOf(pfx) === 0) { arr.push(_xlParsePrimitive(_xlMapType(em), sheet.cellValue(er, colMap[p].col), colMap[p].dt, enums)); break; } } }
      else { var es = schemas[em], eo = {};
        if (es && es.fields) { for (var cid in es.fields) { var cf = es.fields[cid]; var v = _xlReadField(cf, cid, colMap, sheet, er, schemas, enums, fp); if (v !== undefined && v !== null) eo[cf.name] = v; } }
        else { for (var p in colMap) { if (p.indexOf(pfx) === 0) { var rem = p.substring(pfx.length); if (rem.indexOf(".") < 0 && !sheet.isCellEmpty(er, colMap[p].col)) eo[rem] = sheet.cellValue(er, colMap[p].col); } } }
        arr.push(eo);
      }
    } return arr.length > 0 ? arr : undefined;
  }
  var e = colMap[fp]; if (!e) return undefined;
  if (sheet.isCellEmpty(row, e.col)) return undefined;
  return _xlParsePrimitive(type, sheet.cellValue(row, e.col), e.dt, enums);
}
function _fromExcelRow(schema, sheet, row, schemas, enums) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) return {};
  var colMap = _xlBuildColMap(sheet), out = {};
  for (var fid in schema.fields) { var f = schema.fields[fid]; var v = _xlReadField(f, fid, colMap, sheet, row, schemas, enums); if (v !== undefined && v !== null) out[f.name] = v; }
  return out;
}
function _fromExcelSheet(schema, sheet, schemas, enums, firstRow) {
  firstRow = firstRow || _XL_FIRST_DATA; var result = {};
  for (var r = firstRow; r <= sheet.lastRow; r++) { var tuid = sheet.cellValue(r, 1); if (!tuid) continue; var id = parseInt(String(tuid).split(":")[0], 10); if (isNaN(id)) continue; result[id] = _fromExcelRow(schema, sheet, r, schemas, enums); }
  return result;
}

