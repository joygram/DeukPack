/**
 * DpDeukJsonProtocol — Deuk JSON (값만) 프로토콜.
 * 설정·OpenAPI 라운드트립용. 타입 래퍼 없음. 레거시 호환 JSON(DpJsonProtocol)과 별도.
 * See: DeukPack/docs/DEUKPACK_DEUK_JSON_YAML.md
 */
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace DeukPack.Protocol
{
    /// <summary>
    /// Deuk JSON protocol: value-only JSON for config/OpenAPI round-trip.
    /// No type wrappers (i64/str/tf). Optional $deuk header. Use field names as keys when writing.
    /// </summary>
    public class DpDeukJsonProtocol : DpProtocol, IDisposable
    {
        public const string DeukFormatVersion = "deuk/1.0";
        public const string HeaderKeyDeuk = "$deuk";
        public const string HeaderKeyDeukFormat = "deukFormat";

        private readonly Stream _stream;
        private readonly bool _isReadMode;
        private readonly bool _includeDeukHeader;
        private readonly bool _pretty;
        private readonly Stack<DeukStructState> _writeStack;
        private readonly Stack<List<object>> _listWriteStack;
        private readonly Stack<DeukMapState> _mapWriteStack;
        private string _currentFieldKey = "";
        private DpWireType _currentFieldType;
        private Dictionary<string, object> _rootRead;
        private Stack<DeukReadFrame> _readStack;
        private KeyValuePair<string, object>? _currentReadField;
        private List<object>? _readList;
        private int _readListIndex;
        private Dictionary<string, object>? _readMapDict;
        private List<string>? _readMapKeys;
        private int _readMapIndex;
        private bool _readMapReadingKey;
        private string? _readMapCurrentKey;
        private short _readFieldSequenceId;
        private readonly UTF8Encoding _utf8 = new UTF8Encoding(false);

        public DpDeukJsonProtocol(Stream stream, bool pretty = false, bool includeDeukHeader = true, bool isReadMode = true)
        {
            _stream = stream ?? throw new ArgumentNullException(nameof(stream));
            _pretty = pretty;
            _includeDeukHeader = includeDeukHeader;
            _isReadMode = isReadMode;
            _writeStack = new Stack<DeukStructState>();
            _listWriteStack = new Stack<List<object>>();
            _mapWriteStack = new Stack<DeukMapState>();
            _readStack = new Stack<DeukReadFrame>();
            if (isReadMode)
            {
                using (var sr = new StreamReader(stream, _utf8, false, 4096, true))
                {
                    var json = sr.ReadToEnd();
                    _rootRead = DeukJsonParse(json);
                }
            }
            else
            {
                _rootRead = new Dictionary<string, object>();
            }
        }

        public void Dispose()
        {
            _stream?.Flush();
        }

        private struct DeukStructState
        {
            public Dictionary<string, object> Obj;
            public bool IsMapValue;
        }

        private struct DeukReadFrame
        {
            public Dictionary<string, object> Obj;
            public IEnumerator<KeyValuePair<string, object>>? Enumerator;
        }

        private class DeukMapState
        {
            public readonly Dictionary<string, object?> Map = new Dictionary<string, object?>();
            public object? PendingKey;
        }

        private static bool IsReservedKey(string key)
        {
            return key == HeaderKeyDeuk || key == HeaderKeyDeukFormat || key == "$schema";
        }

        private void WriteValueToCurrentRaw(object value)
        {
            if (_mapWriteStack.Count > 0)
            {
                var top = _mapWriteStack.Peek();
                if (top.PendingKey == null)
                    top.PendingKey = value;
                else
                {
                    top.Map[top.PendingKey?.ToString() ?? ""] = value;
                    top.PendingKey = null;
                }
                return;
            }
            if (_listWriteStack.Count > 0)
            {
                _listWriteStack.Peek().Add(value);
                return;
            }
            _writeStack.Peek().Obj[_currentFieldKey] = value;
        }

        public void WriteStructBegin(DpRecord s)
        {
            _writeStack.Push(new DeukStructState { Obj = new Dictionary<string, object>(), IsMapValue = false });
        }

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
                if (_includeDeukHeader && !top.Obj.ContainsKey(HeaderKeyDeuk))
                {
                    var withHeader = new Dictionary<string, object>(top.Obj) { [HeaderKeyDeuk] = DeukFormatVersion };
                    top.Obj = withHeader;
                }
                var json = DeukJsonSerialize(top.Obj);
                if (_pretty) json = FormatJson(json);
                var bytes = _utf8.GetBytes(json);
                _stream.Write(bytes, 0, bytes.Length);
                _stream.Flush();
            }
        }

        private static string FormatJson(string json)
        {
            var sb = new StringBuilder();
            int indent = 0;
            bool quoted = false;
            for (int i = 0; i < json.Length; i++)
            {
                var ch = json[i];
                if (ch == '"' && (i == 0 || json[i - 1] != '\\')) quoted = !quoted;
                if (quoted) { sb.Append(ch); continue; }
                if (ch == '{' || ch == '[')
                {
                    sb.Append(ch).AppendLine().Append(new string(' ', ++indent * 2));
                }
                else if (ch == '}' || ch == ']')
                {
                    sb.AppendLine().Append(new string(' ', --indent * 2)).Append(ch);
                }
                else if (ch == ',')
                {
                    sb.Append(ch).AppendLine().Append(new string(' ', indent * 2));
                }
                else if (ch == ':')
                {
                    sb.Append(ch).Append(" ");
                }
                else
                {
                    sb.Append(ch);
                }
            }
            return sb.ToString();
        }

        public void WriteFieldBegin(DpColumn f)
        {
            _currentFieldKey = !string.IsNullOrEmpty(f.Name) ? f.Name : f.ID.ToString();
            _currentFieldType = f.Type;
        }

        public void WriteFieldEnd() { }
        public void WriteFieldStop() { }

        public void WriteBool(bool b) { WriteValueToCurrentRaw(b); }
        public void WriteByte(byte b) { WriteValueToCurrentRaw((long)b); }
        public void WriteI16(short v) { WriteValueToCurrentRaw((long)v); }
        public void WriteI32(int v) { WriteValueToCurrentRaw((long)v); }
        public void WriteI64(long v) { WriteValueToCurrentRaw(v); }
        public void WriteDouble(double v) { WriteValueToCurrentRaw(v); }
        public void WriteString(string? s) { WriteValueToCurrentRaw(s ?? ""); }
        public void WriteBinary(byte[]? b) { WriteValueToCurrentRaw(Convert.ToBase64String(b ?? Array.Empty<byte>())); }

        public void WriteListBegin(DpList list) { _listWriteStack.Push(new List<object>()); }
        public void WriteListEnd()
        {
            var list = _listWriteStack.Pop();
            if (_mapWriteStack.Count > 0)
            {
                var outer = _mapWriteStack.Peek();
                outer.Map[outer.PendingKey?.ToString() ?? ""] = list;
                outer.PendingKey = null;
            }
            else if (_listWriteStack.Count > 0)
                _listWriteStack.Peek().Add(list);
            else
                _writeStack.Peek().Obj[_currentFieldKey] = list;
        }

        public void WriteSetBegin(DpSet set) { WriteListBegin(new DpList { ElementType = set.ElementType, Count = set.Count }); }
        public void WriteSetEnd() { WriteListEnd(); }

        public void WriteMapBegin(DpDict map) { _mapWriteStack.Push(new DeukMapState()); }
        public void WriteMapEnd()
        {
            var state = _mapWriteStack.Pop();
            if (_mapWriteStack.Count > 0)
            {
                var outer = _mapWriteStack.Peek();
                outer.Map[outer.PendingKey?.ToString() ?? ""] = state.Map;
                outer.PendingKey = null;
            }
            else if (_listWriteStack.Count > 0)
                _listWriteStack.Peek().Add(state.Map);
            else
                _writeStack.Peek().Obj[_currentFieldKey] = state.Map;
        }

        public DpRecord ReadStructBegin()
        {
            if (_readStack.Count == 0)
            {
                _readFieldSequenceId = 0;
                _readStack.Push(new DeukReadFrame { Obj = _rootRead, Enumerator = _rootRead?.GetEnumerator() });
            }
            else if (_readList != null && _readListIndex < _readList.Count)
            {
                var nextObj = _readList[_readListIndex++] as Dictionary<string, object>;
                if (nextObj != null)
                {
                    _readFieldSequenceId = 0;
                    _readStack.Push(new DeukReadFrame { Obj = nextObj, Enumerator = nextObj.GetEnumerator() });
                }
            }
            else if (_readMapDict != null && _readMapKeys != null && _readMapCurrentKey != null && !_readMapReadingKey && _readMapIndex < _readMapKeys.Count)
            {
                var mapVal = _readMapDict[_readMapCurrentKey];
                if (mapVal is Dictionary<string, object> mapStruct)
                {
                    _readFieldSequenceId = 0;
                    _readStack.Push(new DeukReadFrame { Obj = mapStruct, Enumerator = mapStruct.GetEnumerator() });
                    _readMapIndex++;
                    _readMapReadingKey = true;
                }
            }
            else if (_currentReadField.HasValue && _currentReadField.Value.Value is Dictionary<string, object> nextObj)
            {
                _readFieldSequenceId = 0;
                _readStack.Push(new DeukReadFrame { Obj = nextObj, Enumerator = nextObj.GetEnumerator() });
            }
            return new DpRecord("");
        }

        public void ReadStructEnd()
        {
            if (_readStack.Count > 0)
                _readStack.Pop();
        }

        public DpColumn ReadFieldBegin()
        {
            if (_readStack.Count == 0)
                return new DpColumn("", DpWireType.Stop, 0);
            var cur = _readStack.Peek();
            if (cur.Enumerator == null) return new DpColumn("", DpWireType.Stop, 0);
            while (cur.Enumerator.MoveNext())
            {
                var kv = cur.Enumerator.Current;
                if (IsReservedKey(kv.Key)) continue;
                _readFieldSequenceId++;
                var wireType = InferWireType(kv.Value);
                _currentReadField = kv;
                if (wireType == DpWireType.List || wireType == DpWireType.Set)
                {
                    if (kv.Value is List<object> list)
                    {
                        _readList = list;
                        _readListIndex = 0;
                    }
                }
                else if (wireType == DpWireType.Map && kv.Value is Dictionary<string, object> mapDict)
                {
                    _readMapDict = mapDict;
                    _readMapKeys = new List<string>(mapDict.Keys);
                    _readMapIndex = 0;
                    _readMapReadingKey = true;
                }
                return new DpColumn(kv.Key, wireType, _readFieldSequenceId);
            }
            return new DpColumn("", DpWireType.Stop, 0);
        }

        public void ReadFieldEnd() { }

        private static DpWireType InferWireType(object v)
        {
            if (v == null) return DpWireType.String;
            if (v is bool) return DpWireType.Bool;
            if (v is int || v is long) return DpWireType.Int64;
            if (v is double) return DpWireType.Double;
            if (v is string) return DpWireType.String;
            if (v is Dictionary<string, object>) return DpWireType.Struct;
            if (v is List<object>) return DpWireType.List;
            return DpWireType.String;
        }

        private object? ReadRawCurrentValue()
        {
            object? v = null;
            if (_readMapDict != null && _readMapKeys != null && _readMapCurrentKey != null && _readMapIndex < _readMapKeys.Count)
            {
                if (_readMapReadingKey)
                {
                    v = _readMapCurrentKey = _readMapKeys[_readMapIndex];
                    _readMapReadingKey = false;
                }
                else
                {
                    v = _readMapDict[_readMapCurrentKey];
                    _readMapIndex++;
                    _readMapReadingKey = true;
                }
            }
            else if (_readList != null && _readListIndex < _readList.Count)
                v = _readList[_readListIndex++];
            else if (_currentReadField.HasValue)
                v = _currentReadField.Value.Value;
            return v;
        }

        public bool ReadBool() { return Convert.ToBoolean(ReadRawCurrentValue()); }
        public byte ReadByte() { return (byte)Convert.ToInt64(ReadRawCurrentValue()); }
        public short ReadI16() { return (short)Convert.ToInt64(ReadRawCurrentValue()); }
        public int ReadI32() { return (int)Convert.ToInt64(ReadRawCurrentValue()); }
        public long ReadI64() { return Convert.ToInt64(ReadRawCurrentValue()); }
        public double ReadDouble() { return Convert.ToDouble(ReadRawCurrentValue()); }
        public string ReadString() { return ReadRawCurrentValue()?.ToString() ?? ""; }
        public byte[] ReadBinary()
        {
            var s = ReadRawCurrentValue()?.ToString();
            return string.IsNullOrEmpty(s) ? Array.Empty<byte>() : Convert.FromBase64String(s);
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

        private static string DeukJsonSerialize(Dictionary<string, object> obj)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            var first = true;
            foreach (var kv in obj)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append('"').Append(EscapeJson(kv.Key)).Append("\":");
                AppendDeukJsonValue(sb, kv.Value);
            }
            sb.Append('}');
            return sb.ToString();
        }

        private static void AppendDeukJsonValue(StringBuilder sb, object v)
        {
            if (v == null) { sb.Append("null"); return; }
            if (v is bool b) { sb.Append(b ? "true" : "false"); return; }
            if (v is int i) { sb.Append(i); return; }
            if (v is long l) { sb.Append(l); return; }
            if (v is double d) { sb.Append(d.ToString("R", System.Globalization.CultureInfo.InvariantCulture)); return; }
            if (v is string s) { sb.Append('"').Append(EscapeJson(s)).Append('"'); return; }
            if (v is Dictionary<string, object> dict) { sb.Append(DeukJsonSerialize(dict)); return; }
            if (v is List<object> list)
            {
                sb.Append('[');
                for (int j = 0; j < list.Count; j++) { if (j > 0) sb.Append(','); AppendDeukJsonValue(sb, list[j]); }
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

        private static Dictionary<string, object> DeukJsonParse(string json)
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
                if (val != null) obj[key] = val;
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ',') i++;
            }
            return obj;
        }

        private static object? ParseValue(string s, ref int i)
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

        private static List<object?> ParseArray(string s, ref int i)
        {
            var list = new List<object?>();
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

        /// <summary>
        /// Serialize a struct to Deuk JSON (value-only) on the given stream.
        /// </summary>
        public static void ToDeukJson(Stream stream, IDpSerializable value, bool includeDeukHeader = true)
        {
            if (stream == null || value == null) return;
            using (var prot = new DpDeukJsonProtocol(stream, false, includeDeukHeader, isReadMode: false))
                value.Write(prot);
        }

        /// <summary>
        /// Deserialize from Deuk JSON stream into the given struct. Caller must pass an instance to fill.
        /// </summary>
        public static void FromDeukJson(Stream stream, IDpSerializable value)
        {
            if (stream == null || value == null) return;
            using (var prot = new DpDeukJsonProtocol(stream, false, includeDeukHeader: true, isReadMode: true))
                value.Read(prot);
        }
    }
}
