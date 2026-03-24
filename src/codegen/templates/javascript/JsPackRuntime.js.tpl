// --- Deuk native `pack` wire (WireSerializer / WireDeserializer parity, LE) ---
var _PackTag = { Null: 0, False: 1, True: 2, Int32: 3, Int64: 4, Double: 5, String: 6, Binary: 7, Array: 8, Map: 9, Object: 10 };
function _packPushI32(a, v) {
  v = v | 0;
  a.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255);
}
function _packPushStringBytes(a, s) {
  var enc = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : null;
  var bytes;
  if (enc) bytes = enc;
  else {
    bytes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else bytes.push(63);
    }
  }
  _packPushI32(a, bytes.length);
  for (var j = 0; j < bytes.length; j++) a.push(bytes[j] & 255);
}
function _packPushDouble(a, d) {
  var u8 = new Uint8Array(8);
  new DataView(u8.buffer).setFloat64(0, Number(d), true);
  for (var i = 0; i < 8; i++) a.push(u8[i]);
}
function _packPushI64(a, n) {
  var u8 = new Uint8Array(8);
  var dv = new DataView(u8.buffer);
  if (typeof dv.setBigInt64 === "function") {
    dv.setBigInt64(0, BigInt(Math.trunc(Number(n))), true);
  } else {
    var v = Math.trunc(Number(n));
    var lo = v >>> 0;
    var hi = Math.floor(v / 4294967296);
    dv.setUint32(0, lo, true);
    dv.setInt32(4, hi, true);
  }
  for (var i = 0; i < 8; i++) a.push(u8[i]);
}
function _packWriteNumber(a, n) {
  if (!isFinite(n)) {
    a.push(_PackTag.Double);
    _packPushDouble(a, n);
    return;
  }
  var t = Math.trunc(Number(n));
  if (t === n && t >= -2147483648 && t <= 2147483647) {
    a.push(_PackTag.Int32);
    _packPushI32(a, t);
    return;
  }
  if (t === n) {
    a.push(_PackTag.Int64);
    _packPushI64(a, t);
    return;
  }
  a.push(_PackTag.Double);
  _packPushDouble(a, n);
}
function _packWriteValue(a, val, f, schemas) {
  if (val === null || val === undefined) {
    a.push(_PackTag.Null);
    return;
  }
  var t = f ? f.type : "";
  var tn = f ? f.typeName : "";
  if (t === "enum") {
    a.push(_PackTag.Int32);
    _packPushI32(a, val | 0);
    return;
  }
  if (t === "bool") {
    a.push(val ? _PackTag.True : _PackTag.False);
    return;
  }
  if (t === "int8" || t === "byte" || t === "int16" || t === "int32" || t === "date" || t === "time") {
    a.push(_PackTag.Int32);
    _packPushI32(a, val | 0);
    return;
  }
  if (t === "int64" || t === "datetime" || t === "timestamp" || t === "tablelink") {
    a.push(_PackTag.Int64);
    _packPushI64(a, val);
    return;
  }
  if (t === "float" || t === "double") {
    a.push(_PackTag.Double);
    _packPushDouble(a, Number(val));
    return;
  }
  if (t === "string" || t === "decimal" || t === "numeric") {
    a.push(_PackTag.String);
    _packPushStringBytes(a, String(val));
    return;
  }
  if (t === "binary") {
    a.push(_PackTag.Binary);
    var u8 = val && val.buffer ? new Uint8Array(val.buffer, val.byteOffset, val.byteLength) : new Uint8Array(val || []);
    _packPushI32(a, u8.length);
    for (var i = 0; i < u8.length; i++) a.push(u8[i] & 255);
    return;
  }
  if (t === "struct") {
    var cs = schemas && schemas[tn];
    if (!cs) throw new Error("[DeukPack] pack: unknown struct " + tn);
    _packWriteStructBody(a, cs, val, schemas);
    return;
  }
  if (t === "list" || t === "set") {
    var em = (tn.match(/^(?:list|set)<(.+)>$/i) || [])[1];
    em = em ? em.trim() : "";
    var arr = val || [];
    a.push(_PackTag.Array);
    _packPushI32(a, arr.length);
    var fake = { type: _packElemWireType(em), typeName: em, required: true };
    for (var j = 0; j < arr.length; j++) _packWriteValue(a, arr[j], fake, schemas);
    return;
  }
  if (t === "map") {
    var mm = (tn.match(/^map<([^,]+),(.+)>$/i) || []);
    var kt = mm[1] ? mm[1].trim() : "string";
    var vt = mm[2] ? mm[2].trim() : "string";
    var entries = val instanceof Map ? Array.from(val.entries()) : Object.keys(val || {}).map(function (k) { return [k, val[k]]; });
    a.push(_PackTag.Map);
    _packPushI32(a, entries.length);
    var fk = { type: _packElemWireType(kt), typeName: kt, required: true };
    var fv = { type: _packElemWireType(vt), typeName: vt, required: true };
    for (var e = 0; e < entries.length; e++) {
      _packWriteValue(a, entries[e][0], fk, schemas);
      _packWriteValue(a, entries[e][1], fv, schemas);
    }
    return;
  }
  if (typeof val === "boolean") {
    a.push(val ? _PackTag.True : _PackTag.False);
    return;
  }
  if (typeof val === "number") {
    _packWriteNumber(a, val);
    return;
  }
  if (typeof val === "string") {
    a.push(_PackTag.String);
    _packPushStringBytes(a, val);
    return;
  }
  if (val && val.buffer && val.byteLength !== undefined) {
    a.push(_PackTag.Binary);
    var b = new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    _packPushI32(a, b.length);
    for (var x = 0; x < b.length; x++) a.push(b[x] & 255);
    return;
  }
  if (Array.isArray(val)) {
    a.push(_PackTag.Array);
    _packPushI32(a, val.length);
    for (var y = 0; y < val.length; y++) _packWriteValue(a, val[y], null, schemas);
    return;
  }
  if (val instanceof Map) {
    a.push(_PackTag.Map);
    _packPushI32(a, val.size);
    val.forEach(function (vv, kk) {
      _packWriteValue(a, kk, null, schemas);
      _packWriteValue(a, vv, null, schemas);
    });
    return;
  }
  if (typeof val === "object") {
    a.push(_PackTag.Object);
    var keys = Object.keys(val);
    _packPushI32(a, keys.length);
    for (var z = 0; z < keys.length; z++) {
      _packPushStringBytes(a, keys[z]);
      _packWriteValue(a, val[keys[z]], null, schemas);
    }
    return;
  }
  a.push(_PackTag.Null);
}
function _packElemWireType(em) {
  var x = String(em || "").trim().toLowerCase();
  if (x === "bool" || x === "tf") return "bool";
  if (x === "byte" || x === "int8" || x === "i8") return "int8";
  if (x === "int16" || x === "i16") return "int16";
  if (x === "int32" || x === "i32") return "int32";
  if (x === "int64" || x === "i64") return "int64";
  if (x === "float") return "float";
  if (x === "double" || x === "dbl") return "double";
  if (x === "string" || x === "str") return "string";
  if (x === "binary") return "binary";
  if (x === "datetime") return "datetime";
  if (x === "timestamp") return "timestamp";
  if (x === "date") return "date";
  if (x === "time") return "time";
  if (x === "decimal") return "decimal";
  if (x === "numeric") return "numeric";
  if (/^tablelink\s*</i.test(String(em || ""))) return "tablelink";
  return "struct";
}
function _packWriteStructBody(a, schema, obj, schemas) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) throw new Error("[DeukPack] pack: invalid struct schema");
  a.push(_PackTag.Object);
  var ids = Object.keys(schema.fields)
    .map(function (k) { return parseInt(k, 10); })
    .filter(function (x) { return !isNaN(x); })
    .sort(function (p, q) { return p - q; });
  var parts = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var f = schema.fields[id];
    var v = obj && obj[f.name];
    if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue;
    if (v === undefined || v === null) {
      if (f.required) _deukSerializationWarn("missing", schema.name || "Struct", f.name, id);
      continue;
    }
    parts.push(f.name, f, v);
  }
  _packPushI32(a, parts.length / 3);
  for (var j = 0; j < parts.length; j += 3) {
    _packPushStringBytes(a, parts[j]);
    _packWriteValue(a, parts[j + 2], parts[j + 1], schemas);
  }
}
function _structToPackBinary(schema, obj, schemas) {
  var a = [];
  _packWriteStructBody(a, schema, obj, schemas);
  return new Uint8Array(a);
}
function _structToPackBinaryFiltered(schema, obj, schemas, fieldIds, overrides) {
  var a = [];
  _packWriteStructBodyFiltered(a, schema, obj, schemas, fieldIds, overrides);
  return new Uint8Array(a);
}
function _packWriteStructBodyFiltered(a, schema, obj, schemas, fieldIds, overrides) {
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) throw new Error("[DeukPack] pack: invalid struct schema");
  var idSet = fieldIds ? {} : null;
  if (fieldIds) { for (var i = 0; i < fieldIds.length; i++) idSet[fieldIds[i]] = true; }
  a.push(_PackTag.Object);
  var ids = Object.keys(schema.fields)
    .map(function (k) { return parseInt(k, 10); })
    .filter(function (x) { return !isNaN(x); })
    .sort(function (p, q) { return p - q; });
  var parts = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (idSet && !idSet[id]) continue;
    var f = schema.fields[id];
    var v = (overrides && overrides[id] !== undefined) ? overrides[id] : (obj && obj[f.name]);
    if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue;
    if (v === undefined || v === null) {
      if (f.required) _deukSerializationWarn("missing", schema.name || "Struct", f.name, id);
      continue;
    }
    parts.push(f.name, f, v);
  }
  _packPushI32(a, parts.length / 3);
  for (var j = 0; j < parts.length; j += 3) {
    _packPushStringBytes(a, parts[j]);
    _packWriteValue(a, parts[j + 2], parts[j + 1], schemas);
  }
}
function _prU8(r) {
  if (r.i >= r.u8.length) throw new Error("[DeukPack] pack read overflow");
  return r.u8[r.i++];
}
function _prI32(r) {
  var b0 = _prU8(r), b1 = _prU8(r), b2 = _prU8(r), b3 = _prU8(r);
  return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >> 0;
}
function _prI64(r) {
  var dv = new DataView(r.u8.buffer, r.u8.byteOffset + r.i, 8);
  var lo = dv.getUint32(0, true);
  var hi = dv.getInt32(4, true);
  r.i += 8;
  return hi * 4294967296 + lo;
}
function _prDbl(r) {
  var d = new DataView(r.u8.buffer, r.u8.byteOffset + r.i, 8).getFloat64(0, true);
  r.i += 8;
  return d;
}
function _prString(r) {
  var len = _prI32(r);
  if (len < 0 || r.i + len > r.u8.length) throw new Error("[DeukPack] pack string len");
  var sl = r.u8.subarray(r.i, r.i + len);
  r.i += len;
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: true }).decode(sl);
  var s = "";
  for (var i = 0; i < sl.length; i++) s += String.fromCharCode(sl[i]);
  return s;
}
function _prBinary(r) {
  var len = _prI32(r);
  if (len < 0 || r.i + len > r.u8.length) throw new Error("[DeukPack] pack binary len");
  var out = r.u8.slice(r.i, r.i + len);
  r.i += len;
  return out;
}
function _packReadValue(r, f, schemas) {
  var tag = _prU8(r);
  if (tag === _PackTag.Null) return null;
  if (tag === _PackTag.False) return false;
  if (tag === _PackTag.True) return true;
  if (tag === _PackTag.Int32) return _prI32(r);
  if (tag === _PackTag.Int64) return _prI64(r);
  if (tag === _PackTag.Double) return _prDbl(r);
  if (tag === _PackTag.String) return _prString(r);
  if (tag === _PackTag.Binary) return _prBinary(r);
  if (tag === _PackTag.Array) {
    var n = _prI32(r);
    var em = f && f.typeName ? (f.typeName.match(/^(?:list|set)<(.+)>$/i) || [])[1] : "";
    em = em ? em.trim() : "";
    var fake = em ? { type: _packElemWireType(em), typeName: em, required: true } : null;
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(_packReadValue(r, fake, schemas));
    return arr;
  }
  if (tag === _PackTag.Map) {
    var m = _prI32(r);
    var mm = f && f.typeName ? (f.typeName.match(/^map<([^,]+),(.+)>$/i) || []) : [];
    var vt = mm[2] ? mm[2].trim() : "";
    var fv = vt ? { type: _packElemWireType(vt), typeName: vt, required: true } : null;
    var fk = mm[1] ? { type: _packElemWireType(mm[1].trim()), typeName: mm[1].trim(), required: true } : null;
    var o = {};
    for (var j = 0; j < m; j++) {
      var k = _packReadValue(r, fk, schemas);
      o[String(k)] = _packReadValue(r, fv, schemas);
    }
    return o;
  }
  if (tag === _PackTag.Object) {
    var cnt = _prI32(r);
    var o2 = {};
    for (var k = 0; k < cnt; k++) {
      var key = _prString(r);
      var subf = null;
      if (f && f.type === "struct" && schemas && schemas[f.typeName]) {
        var sch = schemas[f.typeName];
        for (var fid in sch.fields) if (sch.fields[fid].name === key) subf = sch.fields[fid];
      }
      o2[key] = _packReadValue(r, subf, schemas);
    }
    return o2;
  }
  throw new Error("[DeukPack] pack: unknown tag " + tag);
}
function _structFromPackBinary(schema, buf, schemas) {
  var u8 = buf && buf.buffer ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(buf || []);
  var r = { u8: u8, i: 0 };
  if (!schema || (schema.type !== "struct" && schema.type !== "Struct") || !schema.fields) throw new Error("[DeukPack] pack: invalid struct schema");
  if (_prU8(r) !== _PackTag.Object) throw new Error("[DeukPack] pack: expected Object tag");
  var cnt = _prI32(r);
  var raw = {};
  for (var i = 0; i < cnt; i++) {
    var key = _prString(r);
    var subf = null;
    for (var fid in schema.fields) {
      if (schema.fields[fid].name === key) subf = schema.fields[fid];
    }
    raw[key] = _packReadValue(r, subf, schemas);
  }
  var out = {};
  for (var id in schema.fields) {
    var f = schema.fields[id];
    var v = raw[f.name];
    if (v === undefined && f.defaultValue !== undefined && f.defaultValue !== null) v = f.defaultValue;
    if (v === undefined && f.required) _deukSerializationWarn("missing", schema.name, f.name, id);
    if (v !== undefined) out[f.name] = v;
  }
  return out;
}
