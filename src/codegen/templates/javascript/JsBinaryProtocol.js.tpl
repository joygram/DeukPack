// --- DeukPack Binary Protocol for JS (Big Endian, Parity with C#/C++/Java) ---
function _jsBinPushI16(a, v) {
  a.push((v >> 8) & 255, v & 255);
}
function _jsBinPushI32(a, v) {
  a.push((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
}
function _jsBinPushI64(a, n) {
  var u8 = new Uint8Array(8);
  new DataView(u8.buffer).setBigInt64(0, BigInt(n), false); // Big Endian
  for (var i = 0; i < 8; i++) a.push(u8[i]);
}
function _jsBinPushDouble(a, d) {
  var u8 = new Uint8Array(8);
  new DataView(u8.buffer).setFloat64(0, Number(d), false);
  for (var i = 0; i < 8; i++) a.push(u8[i]);
}
function _jsBinWriteValue(a, val, type, typeName, schemas) {
  if (val === null || val === undefined) return;
  var wt = _toDpWireType(type);
  switch (wt) {
    case 2: a.push(val ? 1 : 0); break; // Bool
    case 3: a.push(val & 255); break; // Byte
    case 4: _jsBinPushDouble(a, val); break; // Double
    case 6: _jsBinPushI16(a, val); break; // Int16
    case 8: _jsBinPushI32(a, val); break; // Int32
    case 10: _jsBinPushI64(a, val); break; // Int64
    case 11: // String or Binary
      var bytes;
      if (val instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(val))) {
        bytes = val;
      } else {
        bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(String(val)) : Buffer.from(String(val));
      }
      _jsBinPushI32(a, bytes.length);
      for (var i = 0; i < bytes.length; i++) a.push(bytes[i]);
      break;
    case 12: // Struct
      var s = schemas[typeName];
      _jsBinWriteStruct(a, s, val, schemas);
      break;
    case 13: // Map
      var mm = (typeName.match(/map<([^,]+),(.+)>/i) || []);
      var kt = mm[1] ? mm[1].trim() : "string";
      var vt = mm[2] ? mm[2].trim() : "string";
      var entries = val instanceof Map ? Array.from(val.entries()) : Object.keys(val || {}).map(function(k) { return [k, val[k]]; });
      a.push(_toDpWireType(_elemType(kt)));
      a.push(_toDpWireType(_elemType(vt)));
      _jsBinPushI32(a, entries.length);
      var ket = _elemType(kt);
      var vet = _elemType(vt);
      for (var e = 0; e < entries.length; e++) {
        _jsBinWriteValue(a, entries[e][0], ket, kt, schemas);
        _jsBinWriteValue(a, entries[e][1], vet, vt, schemas);
      }
      break;
    case 14: // Set
    case 15: // List
      var em = (typeName.match(/^(?:list|set)<(.+)>$/i) || [])[1] || "int32";
      var arr = Array.isArray(val) ? val : (val instanceof Set ? Array.from(val) : (val || []));
      a.push(_toDpWireType(_elemType(em)));
      _jsBinPushI32(a, arr.length);
      var eet = _elemType(em);
      for (var j = 0; j < arr.length; j++) _jsBinWriteValue(a, arr[j], eet, em, schemas);
      break;
  }
}
function _jsBinWriteStruct(a, schema, obj, schemas) {
  for (var id in schema.fields) {
    var f = schema.fields[id];
    var v = obj[f.name];
    if (v === undefined && f.defaultValue !== undefined) v = f.defaultValue;
    if (v !== undefined) {
      a.push(_toDpWireType(f.type));
      _jsBinPushI16(a, parseInt(id));
      _jsBinWriteValue(a, v, f.type, f.typeName, schemas);
    }
  }
  a.push(0); // Stop
}
function _jsBinReadI16(p) {
  var v = (p.view.getUint8(p.off) << 8) | p.view.getUint8(p.off + 1);
  p.off += 2;
  return v;
}
function _jsBinReadI32(p) {
  var v = p.view.getInt32(p.off, false);
  p.off += 4;
  return v;
}
function _jsBinReadDouble(p) {
  var v = p.view.getFloat64(p.off, false);
  p.off += 8;
  return v;
}
function _jsBinReadString(p) {
  var len = _jsBinReadI32(p);
  if (len === 0) return "";
  var s;
  if (typeof TextDecoder !== "undefined") {
    s = new TextDecoder().decode(new Uint8Array(p.view.buffer, p.view.byteOffset + p.off, len));
  } else {
    s = Buffer.from(p.view.buffer, p.view.byteOffset + p.off, len).toString();
  }
  p.off += len;
  return s;
}

function _jsBinSkip(p, wt) {
  switch (wt) {
    case 2: case 3: p.off += 1; break;
    case 6: p.off += 2; break;
    case 8: p.off += 4; break;
    case 4: case 10: p.off += 8; break;
    case 11: p.off += _jsBinReadI32(p); break;
    case 12: 
      while (true) {
        var swt = p.view.getUint8(p.off++);
        if (swt === 0) break;
        p.off += 2; // id
        _jsBinSkip(p, swt);
      }
      break;
    case 13: // Map
      var kt = p.view.getUint8(p.off++);
      var vt = p.view.getUint8(p.off++);
      var mc = _jsBinReadI32(p);
      for (var i = 0; i < mc; i++) { _jsBinSkip(p, kt); _jsBinSkip(p, vt); }
      break;
    case 14: // Set
    case 15: // List
      var et = p.view.getUint8(p.off++);
      var lc = _jsBinReadI32(p);
      for (var j = 0; j < lc; j++) _jsBinSkip(p, et);
      break;
  }
}

function _jsBinReadValue(p, type, typeName, schemas) {
  var wt = _toDpWireType(type);
  switch (wt) {
    case 2: return p.view.getUint8(p.off++) !== 0; // Bool
    case 3: return p.view.getUint8(p.off++); // Byte
    case 4: return _jsBinReadDouble(p);
    case 6: return _jsBinReadI16(p);
    case 8: return _jsBinReadI32(p);
    case 10: 
      var v = p.view.getBigInt64(p.off, false);
      p.off += 8;
      return v;
    case 11: // String or Binary
      if (type === "binary" || typeName === "binary") {
        var len = _jsBinReadI32(p);
        var buf = new Uint8Array(p.view.buffer, p.view.byteOffset + p.off, len);
        p.off += len;
        return new Uint8Array(buf); // Copy to avoid side effects
      }
      return _jsBinReadString(p);

    case 12: return _jsBinReadStruct(p, schemas[typeName], schemas);
    case 13: // Map
      var emWtK = p.view.getUint8(p.off++);
      var emWtV = p.view.getUint8(p.off++);
      var lenM = _jsBinReadI32(p);
      var objM = {};
      var mm = (typeName.match(/map<([^,]+),(.+)>/i) || []);
      var kt = mm[1] ? mm[1].trim() : "string";
      var vt = mm[2] ? mm[2].trim() : "string";
      var ket = _elemType(kt);
      var vet = _elemType(vt);
      for (var k = 0; k < lenM; k++) {
        var key = _jsBinReadValue(p, ket, kt, schemas);
        objM[String(key)] = _jsBinReadValue(p, vet, vt, schemas);
      }
      return objM;
    case 14: // Set
    case 15: // List
      var emWt = p.view.getUint8(p.off++);
      var len = _jsBinReadI32(p);
      var arr = [];
      var em = (typeName.match(/^(?:list|set)<(.+)>$/i) || [])[1] || "int32";
      var eet = _elemType(em);
      for (var j = 0; j < len; j++) arr.push(_jsBinReadValue(p, eet, em, schemas));
      return arr;
    default: 
      _jsBinSkip(p, wt);
      return null;
  }
}

function _jsBinReadStruct(p, schema, schemas) {
  var obj = {};
  if (!schema) return obj;
  if (schema._readBin) return schema._readBin(p, schemas);
  if (!p.depth) p.depth = 0;
  if (++p.depth > 64) {
    throw new Error("Max recursion depth exceeded");
  }
  while (true) {
    var wt = p.view.getUint8(p.off++);
    if (wt === 0) break;
    var id = _jsBinReadI16(p);
    var f = schema.fields[id];
    if (f) {
      obj[f.name] = _jsBinReadValue(p, f.type, f.typeName, schemas);
    } else {
      _jsBinSkip(p, wt);
    }
  }
  p.depth--;
  return obj;
}

function _structToBinary(schema, obj, schemas) {
  var a = [];
  _jsBinWriteStruct(a, schema, obj, schemas);
  return new Uint8Array(a);
}
function _structFromBinary(schema, buf, schemas) {
  var u8 = buf && buf.buffer ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(buf || []);
  var p = { view: new DataView(u8.buffer, u8.byteOffset, u8.byteLength), off: 0 };
  return _jsBinReadStruct(p, schema, schemas);
}

function _toDpWireType(t) {
  var x = String(t).toLowerCase();
  if (x === "bool") return 2;
  if (x === "byte" || x === "int8") return 3;
  if (x === "double" || x === "float") return 4;
  if (x === "int16") return 6;
  if (x === "int32" || x === "enum") return 8;
  if (x === "int64") return 10;
  if (x === "string" || x === "binary") return 11;
  if (x === "struct") return 12;
  if (x === "map") return 13;
  if (x === "set") return 14;
  if (x === "list") return 15;
  return 0; // Stop
}
