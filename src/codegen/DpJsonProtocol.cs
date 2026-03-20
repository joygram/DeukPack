/**
 * DpJsonProtocol — JSON 프로토콜. DpProtocolLibrary 모듈화.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace DeukPack.Protocol
{
    /// <summary>
    /// JSON protocol (TJSONProtocol-compatible).
    /// Stream-based; constructor(stream, includeSchema, isReadMode).
    /// </summary>
    public class DpJsonProtocol : DpProtocol
    {
        private readonly Stream _stream;
        private readonly bool _isReadMode;
        private readonly bool _includeSchema;
        private readonly Stack<JsonStructState> _writeStack;
        private readonly Stack<List<object>> _listWriteStack;
        private readonly Stack<MapWriteState> _mapWriteStack;
        private string _currentFieldKey;
        private DpWireType _currentFieldType;
        private Dictionary<string, object> _rootRead;
        private Stack<JsonReadCursor> _readStack;
        private KeyValuePair<string, object>? _currentReadField;
        private List<object> _readList;
        private int _readListIndex;
        private Dictionary<string, object> _readMapDict;
        private List<string> _readMapKeys;
        private int _readMapIndex;
        private bool _readMapReadingKey;
        private string _readMapCurrentKey;
        private readonly UTF8Encoding _utf8 = new UTF8Encoding(false);

        public DpJsonProtocol(Stream stream, bool includeSchema = false, bool isReadMode = true)
        {
            _stream = stream ?? throw new ArgumentNullException(nameof(stream));
            _includeSchema = includeSchema;
            _isReadMode = isReadMode;
            _writeStack = new Stack<JsonStructState>();
            _listWriteStack = new Stack<List<object>>();
            _mapWriteStack = new Stack<MapWriteState>();
            _readStack = new Stack<JsonReadCursor>();
            if (isReadMode)
            {
                using (var sr = new StreamReader(stream, _utf8, false, 4096, true))
                {
                    var json = sr.ReadToEnd();
                    _rootRead = JsonProtocolParse(json);
                }
            }
        }

        private struct JsonStructState
        {
            public Dictionary<string, object> Obj;
            public bool IsMapKey;
        }

        private struct JsonReadCursor
        {
            public Dictionary<string, object> Obj;
            public IEnumerator<KeyValuePair<string, object>> Enumerator;
        }

        private class MapWriteState
        {
            public readonly Dictionary<string, object> Map = new Dictionary<string, object>();
            public object PendingKey;
        }

        private static string DpWireTypeToJsonKey(DpWireType t)
        {
            return DpTypeNames.ToProtocolName(t);
        }

        private static object WrapValueForJson(object value)
        {
            if (value == null) return null;
            if (value is Dictionary<string, object> d) return d;
            if (value is List<object> l) return new Dictionary<string, object> { { "lst", l } };
            if (value is bool b) return new Dictionary<string, object> { { "tf", b } };
            if (value is int || value is long || value is short || value is byte) return new Dictionary<string, object> { { "i64", Convert.ToInt64(value) } };
            if (value is double db) return new Dictionary<string, object> { { "dbl", db } };
            return new Dictionary<string, object> { { "str", value.ToString() } };
        }

        private void WriteValueToCurrent(object value)
        {
            if (_mapWriteStack.Count > 0)
            {
                var top = _mapWriteStack.Peek();
                if (top.PendingKey == null)
                    top.PendingKey = value;
                else
                {
                    var keyStr = top.PendingKey?.ToString() ?? "";
                    top.Map[keyStr] = WrapValueForJson(value);
                    top.PendingKey = null;
                }
                return;
            }
            if (_listWriteStack.Count > 0)
            {
                _listWriteStack.Peek().Add(value);
                return;
            }
            var wrapper = new Dictionary<string, object> { { DpWireTypeToJsonKey(_currentFieldType), value } };
            _writeStack.Peek().Obj[_currentFieldKey] = wrapper;
        }

        public void WriteStructBegin(DpRecord s) { _writeStack.Push(new JsonStructState { Obj = new Dictionary<string, object>(), IsMapKey = false }); }
        public void WriteStructEnd()
        {
            var top = _writeStack.Pop();
            if (_mapWriteStack.Count > 0)
            {
                var outer = _mapWriteStack.Peek();
                outer.Map[outer.PendingKey?.ToString() ?? ""] = top.Obj;
                outer.PendingKey = null;
            }
            else if (_listWriteStack.Count > 0)
                _listWriteStack.Peek().Add(top.Obj);
            else if (_writeStack.Count > 0)
                _writeStack.Peek().Obj[_currentFieldKey] = top.Obj;
            else
            {
                var json = JsonProtocolSerialize(top.Obj);
                var bytes = _utf8.GetBytes(json);
                _stream.Write(bytes, 0, bytes.Length);
                _stream.Flush();
            }
        }
        public void WriteFieldBegin(DpColumn f) { _currentFieldKey = f.ID.ToString(); _currentFieldType = f.Type; }
        public void WriteFieldEnd() { }
        public void WriteFieldStop() { }
        public void WriteBool(bool b) { WriteValueToCurrent(b); }
        public void WriteByte(byte b) { WriteValueToCurrent((int)b); }
        public void WriteI16(short v) { WriteValueToCurrent(v); }
        public void WriteI32(int v) { WriteValueToCurrent(v); }
        public void WriteI64(long v) { WriteValueToCurrent(v); }
        public void WriteDouble(double v) { WriteValueToCurrent(v); }
        public void WriteString(string s) { WriteValueToCurrent(s ?? ""); }
        public void WriteBinary(byte[] b) { WriteValueToCurrent(Convert.ToBase64String(b ?? Array.Empty<byte>())); }
        public void WriteListBegin(DpList list) { _listWriteStack.Push(new List<object>()); }
        public void WriteListEnd()
        {
            var list = _listWriteStack.Pop();
            var wrapper = new Dictionary<string, object> { { "lst", list } };
            if (_mapWriteStack.Count > 0)
            {
                var outer = _mapWriteStack.Peek();
                outer.Map[outer.PendingKey?.ToString() ?? ""] = wrapper;
                outer.PendingKey = null;
            }
            else if (_listWriteStack.Count > 0)
                _listWriteStack.Peek().Add(list);
            else
                _writeStack.Peek().Obj[_currentFieldKey] = wrapper;
        }
        public void WriteSetBegin(DpSet set) { WriteListBegin(new DpList { ElementType = set.ElementType, Count = set.Count }); }
        public void WriteSetEnd() { WriteListEnd(); }
        public void WriteMapBegin(DpDict map) { _mapWriteStack.Push(new MapWriteState()); }
        public void WriteMapEnd()
        {
            var state = _mapWriteStack.Pop();
            var wrapper = new Dictionary<string, object> { { "map", state.Map } };
            if (_mapWriteStack.Count > 0)
            {
                var outer = _mapWriteStack.Peek();
                outer.Map[outer.PendingKey?.ToString() ?? ""] = wrapper;
                outer.PendingKey = null;
            }
            else if (_listWriteStack.Count > 0)
                _listWriteStack.Peek().Add(wrapper);
            else
                _writeStack.Peek().Obj[_currentFieldKey] = wrapper;
        }

        public DpRecord ReadStructBegin()
        {
            if (_readStack.Count == 0)
                _readStack.Push(new JsonReadCursor { Obj = _rootRead, Enumerator = _rootRead?.GetEnumerator() });
            else if (_readList != null && _readListIndex < _readList.Count)
            {
                var nextObj = _readList[_readListIndex++] as Dictionary<string, object>;
                if (nextObj != null)
                    _readStack.Push(new JsonReadCursor { Obj = nextObj, Enumerator = nextObj.GetEnumerator() });
            }
            else if (_readMapDict != null && !_readMapReadingKey && _readMapIndex < _readMapKeys.Count)
            {
                var mapVal = _readMapDict[_readMapCurrentKey];
                if (mapVal is Dictionary<string, object> mapStruct)
                {
                    _readStack.Push(new JsonReadCursor { Obj = mapStruct, Enumerator = mapStruct.GetEnumerator() });
                    _readMapIndex++;
                    _readMapReadingKey = true;
                }
            }
            else if (_currentReadField.HasValue && _currentReadField.Value.Value is Dictionary<string, object> nextObj)
                _readStack.Push(new JsonReadCursor { Obj = nextObj, Enumerator = nextObj.GetEnumerator() });
            return new DpRecord("");
        }
        public void ReadStructEnd() { if (_readStack.Count > 0) _readStack.Pop(); }
        public DpColumn ReadFieldBegin()
        {
            if (_readStack.Count == 0)
                return new DpColumn("", DpWireType.Stop, 0);
            var cur = _readStack.Peek();
            if (cur.Enumerator == null || !cur.Enumerator.MoveNext())
                return new DpColumn("", DpWireType.Stop, 0);
            var kv = cur.Enumerator.Current;
            var wrapper = kv.Value as Dictionary<string, object>;
            if (wrapper == null) { _currentReadField = kv; return new DpColumn(kv.Key, DpWireType.String, 0); }
            DpWireType t = DpWireType.Stop;
            foreach (var key in wrapper.Keys)
            {
                t = DpTypeNames.FromProtocolName(key);
                break;
            }
            _currentReadField = kv;
            if ((t == DpWireType.List || t == DpWireType.Set) && wrapper.TryGetValue(DpTypeNames.ToProtocolName(t), out var listVal) && listVal is List<object> list)
            {
                _readList = list;
                _readListIndex = 0;
            }
            else if (t == DpWireType.Map && wrapper.TryGetValue(DpTypeNames.ToProtocolName(t), out var mapVal) && mapVal is Dictionary<string, object> mapDict)
            {
                _readMapDict = mapDict;
                _readMapKeys = new List<string>(mapDict.Keys);
                _readMapIndex = 0;
                _readMapReadingKey = true;
            }
            return new DpColumn(kv.Key, t, short.TryParse(kv.Key, out var id) ? id : (short)0);
        }
        public void ReadFieldEnd() { }
        public bool ReadBool() { return ReadSingleValue<bool>("tf"); }
        public byte ReadByte() { return (byte)ReadSingleValue<long>("i8"); }
        public short ReadI16() { return (short)ReadSingleValue<long>("i16"); }
        public int ReadI32() { return (int)ReadSingleValue<long>("i32"); }
        public long ReadI64() { return ReadSingleValue<long>("i64"); }
        public double ReadDouble() { return ReadSingleValue<double>("dbl"); }
        public string ReadString() { return ReadSingleValue<string>("str") ?? ""; }
        public byte[] ReadBinary() { var s = ReadSingleValue<string>("str"); return string.IsNullOrEmpty(s) ? Array.Empty<byte>() : Convert.FromBase64String(s); }
        private T ReadSingleValue<T>(string key)
        {
            object v = null;
            if (_readMapDict != null && _readMapIndex < _readMapKeys.Count)
            {
                if (_readMapReadingKey)
                {
                    v = _readMapCurrentKey = _readMapKeys[_readMapIndex];
                    _readMapReadingKey = false;
                }
                else
                {
                    var valObj = _readMapDict[_readMapCurrentKey];
                    if (valObj is Dictionary<string, object> dict)
                    {
                        if (dict.TryGetValue(key, out v)) { }
                        else if (dict.TryGetValue("i32", out v) || dict.TryGetValue("i64", out v) || dict.TryGetValue("i8", out v) || dict.TryGetValue("i16", out v)) { }
                        else if (dict.TryGetValue("str", out v)) { }
                        else if (dict.TryGetValue("dbl", out v)) { }
                        else if (dict.TryGetValue("tf", out v)) { }
                    }
                    else
                        v = valObj;
                    _readMapIndex++;
                    _readMapReadingKey = true;
                }
            }
            else if (_readList != null && _readListIndex < _readList.Count)
            {
                var raw = _readList[_readListIndex++];
                if (raw is Dictionary<string, object> dict)
                {
                    if (dict.TryGetValue(key, out v)) { }
                    else if (dict.TryGetValue("i32", out v) || dict.TryGetValue("i64", out v) || dict.TryGetValue("i8", out v) || dict.TryGetValue("i16", out v)) { }
                    else if (dict.TryGetValue("str", out v)) { }
                    else if (dict.TryGetValue("dbl", out v)) { }
                    else if (dict.TryGetValue("tf", out v)) { }
                }
                else
                    v = raw;
            }
            else if (_currentReadField.HasValue)
            {
                var wrapper = _currentReadField.Value.Value as Dictionary<string, object>;
                if (wrapper != null) wrapper.TryGetValue(key, out v);
            }
            if (v == null) return default;
            if (typeof(T) == typeof(string)) return (T)(object)v.ToString();
            if (typeof(T) == typeof(bool)) return (T)(object)Convert.ToBoolean(v);
            if (typeof(T) == typeof(long)) return (T)(object)Convert.ToInt64(v);
            if (typeof(T) == typeof(double)) return (T)(object)Convert.ToDouble(v);
            return default;
        }
        public DpList ReadListBegin()
        {
            int c = _readList?.Count ?? 0;
            return new DpList { ElementType = DpWireType.String, Count = c };
        }
        public void ReadListEnd() { _readList = null; }
        public DpSet ReadSetBegin() { var l = ReadListBegin(); return new DpSet { ElementType = l.ElementType, Count = l.Count }; }
        public void ReadSetEnd() { }
        public DpDict ReadMapBegin()
        {
            int c = _readMapDict?.Count ?? 0;
            return new DpDict { KeyType = DpWireType.String, ValueType = DpWireType.String, Count = c };
        }
        public void ReadMapEnd() { _readMapDict = null; _readMapKeys = null; }

        private static string JsonProtocolSerialize(Dictionary<string, object> obj)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            var first = true;
            foreach (var kv in obj)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append('"').Append(EscapeJson(kv.Key)).Append("\":");
                AppendJsonValue(sb, kv.Value);
            }
            sb.Append('}');
            return sb.ToString();
        }
        private static void AppendJsonValue(StringBuilder sb, object v)
        {
            if (v == null) { sb.Append("null"); return; }
            if (v is bool b) { sb.Append(b ? "true" : "false"); return; }
            if (v is int i) { sb.Append(i); return; }
            if (v is long l) { sb.Append(l); return; }
            if (v is double d) { sb.Append(d.ToString("R", System.Globalization.CultureInfo.InvariantCulture)); return; }
            if (v is string s) { sb.Append('"').Append(EscapeJson(s)).Append('"'); return; }
            if (v is Dictionary<string, object> dict) { sb.Append(JsonProtocolSerialize(dict)); return; }
            if (v is List<object> list)
            {
                sb.Append('[');
                for (int j = 0; j < list.Count; j++) { if (j > 0) sb.Append(','); AppendJsonValue(sb, list[j]); }
                sb.Append(']');
                return;
            }
            sb.Append("null");
        }
        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
        }
        private static Dictionary<string, object> JsonProtocolParse(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, object>();
            int i = 0;
            return ParseObject(json, ref i);
        }
        private static Dictionary<string, object> ParseObject(string s, ref int i)
        {
            var obj = new Dictionary<string, object>();
            SkipWs(s, ref i);
            if (i >= s.Length || s[i] != '{') return obj;
            i++;
            while (i < s.Length)
            {
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == '}') { i++; return obj; }
                var key = ParseString(s, ref i);
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ':') i++;
                SkipWs(s, ref i);
                var val = ParseValue(s, ref i);
                obj[key] = val;
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ',') i++;
            }
            return obj;
        }
        private static object ParseValue(string s, ref int i)
        {
            SkipWs(s, ref i);
            if (i >= s.Length) return null;
            if (s[i] == '{') return ParseObject(s, ref i);
            if (s[i] == '[') return ParseArray(s, ref i);
            if (s[i] == '"') return ParseString(s, ref i);
            if (s[i] == 't' || s[i] == 'f') return ParseBool(s, ref i);
            if (s[i] == 'n') { ParseToken(s, ref i, "null"); return null; }
            return ParseNumber(s, ref i);
        }
        private static List<object> ParseArray(string s, ref int i)
        {
            var list = new List<object>();
            if (i >= s.Length || s[i] != '[') return list;
            i++;
            SkipWs(s, ref i);
            while (i < s.Length && s[i] != ']')
            {
                list.Add(ParseValue(s, ref i));
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ',') i++;
            }
            if (i < s.Length) i++;
            return list;
        }
        private static string ParseString(string s, ref int i)
        {
            if (i >= s.Length || s[i] != '"') return "";
            i++;
            var sb = new StringBuilder();
            while (i < s.Length && s[i] != '"')
            {
                if (s[i] == '\\') { i++; if (i < s.Length) sb.Append(s[i++]); }
                else sb.Append(s[i++]);
            }
            if (i < s.Length) i++;
            return sb.ToString();
        }
        private static bool ParseBool(string s, ref int i) { if (ParseToken(s, ref i, "true")) return true; ParseToken(s, ref i, "false"); return false; }
        private static bool ParseToken(string s, ref int i, string tok) { int start = i; foreach (var c in tok) { if (i < s.Length && s[i] == c) i++; else { i = start; return false; } } return true; }
        private static object ParseNumber(string s, ref int i)
        {
            int start = i;
            if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
            while (i < s.Length && char.IsDigit(s[i])) i++;
            if (i < s.Length && s[i] == '.') { i++; while (i < s.Length && char.IsDigit(s[i])) i++; return double.Parse(s.Substring(start, i - start), System.Globalization.CultureInfo.InvariantCulture); }
            return long.Parse(s.Substring(start, i - start), System.Globalization.CultureInfo.InvariantCulture);
        }
        private static void SkipWs(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
    }
}
