/**
 * DeukPack Protocol Core — 인터페이스·와이어 타입·스키마·타입명 유틸.
 * DpProtocolLibrary 모듈화: 공통 타입만 포함.
 */
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text.RegularExpressions;

namespace DeukPack.Protocol
{
    public interface IDpSerializable
    {
        void Write(DpProtocol oprot);
        void Read(DpProtocol iprot);
    }

    public interface IDeukPack : IDpSerializable
    {
        object Clone();
        string ToString();
    }

    public interface IDeukMetaContainer : IDeukPack
    {
        object? Header { get; set; }
        IReadOnlyDictionary<long, IDeukPack> Infos { get; }
    }

    public interface IDeukMetaContainer<T> : IDeukMetaContainer where T : IDeukPack
    {
        IReadOnlyDictionary<long, T> Data { get; }
    }

    public sealed class DpMetaInfosWrapper<T> : IReadOnlyDictionary<long, IDeukPack> where T : IDeukPack
    {
        readonly IReadOnlyDictionary<long, T> _inner;
        public DpMetaInfosWrapper(IReadOnlyDictionary<long, T> inner) { _inner = inner ?? throw new ArgumentNullException(nameof(inner)); }
        public int Count => _inner.Count;
        public bool ContainsKey(long key) => _inner.ContainsKey(key);
        public bool TryGetValue(long key, [MaybeNullWhen(false)] out IDeukPack value)
        {
            if (_inner.TryGetValue(key, out T? v)) { value = v; return true; }
            value = null!; return false;
        }
        public IDeukPack this[long key] => _inner[key];
        public IEnumerable<long> Keys => _inner.Keys;
        public IEnumerable<IDeukPack> Values => _inner.Values.Cast<IDeukPack>();
        public IEnumerator<KeyValuePair<long, IDeukPack>> GetEnumerator()
        {
            foreach (var kv in _inner)
                yield return new KeyValuePair<long, IDeukPack>(kv.Key, kv.Value);
        }
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }

    public enum DpSchemaType { Bool, Byte, Int16, Int32, Int64, Double, String, Binary, Struct, Enum, List, Set, Map }

    public enum DpDefinitionKind { Struct, Enum, Typedef, Constant }

    public class DpFieldSchema
    {
        public int Id { get; set; }
        public int Order { get; set; }
        public string Name { get; set; } = "";
        public DpSchemaType Type { get; set; }
        public string TypeName { get; set; } = "";
        public bool Required { get; set; }
        public object? DefaultValue { get; set; }
        public string? DocComment { get; set; }
        public Dictionary<string, string>? Annotations { get; set; }
    }

    public class DpSchema
    {
        public string Name { get; set; } = "";
        public DpDefinitionKind Type { get; set; }
        public Dictionary<int, DpFieldSchema> Fields { get; set; } = new();
        public string? DocComment { get; set; }
        public Dictionary<string, string>? Annotations { get; set; }
    }

    /// <summary>
    /// 바이너리 와이어 필드 구분자(Thrift TType과 동일한 바이트 값).
    /// 정수 멤버명은 IDL <c>int16</c>/<c>int32</c>/<c>int64</c>와 대응. 레거시 JSON 키 <c>i16</c>/<c>i32</c>/<c>i64</c>는 호환용.
    /// 부호 없는 정수는 동일 폭과 같은 와이어(§2.2.1).
    /// </summary>
    public enum DpWireType
    {
        Stop = 0, Void = 1, Bool = 2, Byte = 3, Double = 4,
        /// <summary>와이어 값 6(Thrift T_I16). IDL <c>int16</c>/<c>uint16</c>.</summary>
        Int16 = 6,
        /// <summary>와이어 값 8(Thrift T_I32). IDL <c>int32</c>/<c>uint32</c>.</summary>
        Int32 = 8,
        /// <summary>와이어 값 10(Thrift T_I64). IDL <c>int64</c>/<c>uint64</c>.</summary>
        Int64 = 10,
        String = 11, Binary = 11, Struct = 12, Map = 13, Set = 14, List = 15,
        /// <summary>IDL uint8. 와이어는 <see cref="DpWireType.Byte"/>와 동일(i8).</summary>
        U8 = Byte,
        /// <summary>IDL uint16. 와이어는 <see cref="DpWireType.Int16"/>와 동일.</summary>
        U16 = Int16,
        /// <summary>IDL uint32. 와이어는 <see cref="DpWireType.Int32"/>와 동일.</summary>
        U32 = Int32,
        /// <summary>IDL uint64. 와이어는 <see cref="DpWireType.Int64"/>와 동일.</summary>
        U64 = Int64,
    }

    /// <summary>
    /// DeukPack.Protocol 런타임 직렬화 스트림 포맷. 레거시 JSON(<see cref="DpFormat.Json"/>)과 Deuk 값만 JSON·YAML(<see cref="DpFormat.DeukJson"/>, <see cref="DpFormat.DeukYaml"/>)은 스펙이 다르다.
    /// <see cref="DeukPackSerializer"/>·프로토콜 구현체가 공통으로 참조한다.
    /// </summary>
    public enum DpFormat
    {
        /// <summary>득팩 태그 바이너리 팩 (<see cref="DpBinaryProtocol"/>).</summary>
        Binary,
        /// <summary>Thrift/레거시 호환 JSON — 필드 타입 래퍼(<see cref="DpJsonProtocol"/>).</summary>
        Json,
        /// <summary>Deuk 값만 JSON — 설정·OpenAPI 라운드트립 (<see cref="DpDeukJsonProtocol"/>).</summary>
        DeukJson,
        /// <summary>Deuk 값만 YAML — npm/TS <c>protocol: 'yaml'</c> 과 동일 계열 (<see cref="DpDeukYamlProtocol"/>).</summary>
        DeukYaml,
        /// <summary><see cref="DeukYaml"/> 과 동일 값(이전 이름).</summary>
        Yaml = DeukYaml,
    }

    public static class DpTypeNames
    {
        /// <summary>DpSchemaType → 득팩 표준 소문자 문자열 (스키마/메타용). ToString() 대신 사용.</summary>
        public static string SchemaTypeToStandardString(DpSchemaType t)
        {
            switch (t)
            {
                case DpSchemaType.Bool: return "bool";
                case DpSchemaType.Byte: return "byte";
                case DpSchemaType.Int16: return "int16";
                case DpSchemaType.Int32: return "int32";
                case DpSchemaType.Int64: return "int64";
                case DpSchemaType.Double: return "double";
                case DpSchemaType.String: return "string";
                case DpSchemaType.Binary: return "binary";
                case DpSchemaType.Struct: return "struct";
                case DpSchemaType.Enum: return "enum";
                case DpSchemaType.List: return "list";
                case DpSchemaType.Set: return "set";
                case DpSchemaType.Map: return "map";
                default: return "string";
            }
        }

        public static string ToProtocolName(DpWireType t)
        {
            switch (t)
            {
                case DpWireType.Bool: return "bool";
                case DpWireType.Byte: return "byte";
                case DpWireType.Int16: return "int16";
                case DpWireType.Int32: return "int32";
                case DpWireType.Int64: return "int64";
                case DpWireType.Double: return "double";
                case DpWireType.String: return "string";
                case DpWireType.Struct: return "record";
                case DpWireType.List: return "list";
                case DpWireType.Set: return "set";
                case DpWireType.Map: return "map";
                default: return "string";
            }
        }

        /// <summary>문자열 타입명 → 와이어. <c>int32</c> 등 IDL 권장명과 <c>i32</c> 등 Thrift/레거시 JSON 키 모두 허용.</summary>
        public static DpWireType FromProtocolName(string dt)
        {
            if (string.IsNullOrEmpty(dt)) return DpWireType.String;
            string lower = dt.Trim().ToLowerInvariant();
            if (lower == "i64" || lower == "int64" || lower == "u64" || lower == "uint64") return DpWireType.Int64;
            if (lower == "i32" || lower == "int32" || lower == "u32" || lower == "uint32") return DpWireType.Int32;
            if (lower == "i16" || lower == "int16" || lower == "u16" || lower == "uint16") return DpWireType.Int16;
            if (lower == "i8" || lower == "int8" || lower == "byte" || lower == "u8" || lower == "uint8") return DpWireType.Byte;
            if (lower == "str" || lower == "string") return DpWireType.String;
            if (lower == "dbl" || lower == "double") return DpWireType.Double;
            if (lower == "tf" || lower == "bool") return DpWireType.Bool;
            if (lower == "rec" || lower == "record") return DpWireType.Struct;
            if (lower.StartsWith("lst") || lower.StartsWith("list")) return DpWireType.List;
            if (lower.StartsWith("set")) return DpWireType.Set;
            if (lower.StartsWith("map")) return DpWireType.Map;
            if (lower.StartsWith("enum")) return DpWireType.Int32;
            if (dt.IndexOf('.') >= 0) return DpWireType.Struct;
            return DpWireType.String;
        }

        public static bool IsContainerType(DpWireType t) =>
            t == DpWireType.Struct || t == DpWireType.List || t == DpWireType.Set || t == DpWireType.Map;

        public static bool IsEnumDataType(string dataType) =>
            !string.IsNullOrWhiteSpace(dataType) && dataType.Trim().StartsWith("enum<", StringComparison.OrdinalIgnoreCase);

        public static string NormalizeDataTypeString(string dataType) =>
            string.IsNullOrEmpty(dataType) ? (dataType ?? "") : Regex.Replace(dataType, @"enum\s+<", "enum<");

        public static DpWireType FromSchemaTypeName(string name)
        {
            if (string.IsNullOrEmpty(name)) return DpWireType.String;
            switch (name)
            {
                case "bool": case "Bool": return DpWireType.Bool;
                case "byte": case "Byte": return DpWireType.Byte;
                case "U8": return DpWireType.U8;
                case "int16": case "Int16": case "I16": return DpWireType.Int16;
                case "U16": return DpWireType.U16;
                case "int32": case "Int32": case "I32": return DpWireType.Int32;
                case "U32": return DpWireType.U32;
                case "int64": case "Int64": case "I64": return DpWireType.Int64;
                case "U64": return DpWireType.U64;
                case "double": case "Double": return DpWireType.Double;
                case "string": case "String":
                case "binary": case "Binary": return DpWireType.String;
                case "struct": case "Struct": return DpWireType.Struct;
                case "list": case "List": return DpWireType.List;
                case "set": case "Set": return DpWireType.Set;
                case "map": case "Map": return DpWireType.Map;
                case "enum": case "Enum": return DpWireType.Int32;
                default: return DpWireType.String;
            }
        }

        public static string StripNamespaceFromTypeName(string typeName)
        {
            if (string.IsNullOrWhiteSpace(typeName)) return "";
            string s = typeName.Trim();
            int dot = s.LastIndexOf('.');
            return dot >= 0 ? s.Substring(dot + 1) : s;
        }

        public static string NormalizeTypeNameForDisplay(string dataType)
        {
            if (string.IsNullOrWhiteSpace(dataType)) return "";
            string s = dataType.Trim();
            int lt = s.IndexOf('<');
            int gt = s.LastIndexOf('>');
            if (lt >= 0 && gt > lt)
            {
                string prefix = s.Substring(0, lt).Trim().ToLowerInvariant();
                string inner = s.Substring(lt + 1, gt - lt - 1).Trim();
                if (prefix == "map")
                {
                    int comma = inner.IndexOf(',');
                    if (comma >= 0)
                    {
                        string k = NormalizeTypeNameForDisplay(inner.Substring(0, comma).Trim());
                        string v = NormalizeTypeNameForDisplay(inner.Substring(comma + 1).Trim());
                        return "map<" + k + ", " + v + ">";
                    }
                }
                string innerDisplay = NormalizeTypeNameForDisplay(inner);
                if (prefix == "lst" || prefix == "list") return "list<" + innerDisplay + ">";
                if (prefix == "set") return "set<" + innerDisplay + ">";
                if (prefix == "map") return "map<" + innerDisplay + ">";
                if (prefix == "enum") return "enum<" + StripNamespaceFromTypeName(inner) + ">";
                if (prefix == "rec" || prefix == "record") return "record<" + innerDisplay + ">";
                return s;
            }
            if (s.IndexOf('.') >= 0) return StripNamespaceFromTypeName(s);
            return s;
        }

        public static string ToDisplayTypeName(string dataType)
        {
            if (string.IsNullOrWhiteSpace(dataType)) return "";
            string s = NormalizeDataTypeString(dataType.Trim());
            if (s.IndexOf('<') >= 0)
            {
                string prefix = s.Substring(0, s.IndexOf('<')).Trim().ToLowerInvariant();
                string inner = StripOuterGeneric(s);
                string innerDisplay = ToDisplayTypeName(inner);
                if (prefix == "lst") return "list<" + innerDisplay + ">";
                if (prefix == "rec" || prefix == "record") return "record<" + innerDisplay + ">";
                if (prefix == "list" || prefix == "set" || prefix == "map" || prefix == "enum") return prefix + "<" + innerDisplay + ">";
                return s;
            }
            string lower = s.ToLowerInvariant();
            if (lower == "i8") return "byte";
            if (lower == "i16") return "int16";
            if (lower == "i32") return "int32";
            if (lower == "i64") return "int64";
            if (lower == "dbl") return "double";
            if (lower == "str") return "string";
            if (lower == "tf") return "bool";
            if (lower == "rec") return "record";
            if (lower == "lst") return "list";
            return s;
        }

        public static string StripOuterGeneric(string typeName)
        {
            if (string.IsNullOrEmpty(typeName)) return typeName;
            int lt = typeName.IndexOf('<');
            int gt = typeName.LastIndexOf('>');
            if (lt > 0 && gt > lt) return typeName.Substring(lt + 1, gt - lt - 1).Trim();
            return typeName;
        }

        public static string SchemaFieldToDataType(DpFieldSchema f)
        {
            if (f == null) return "string";
            string typeName = (f.TypeName ?? "").Trim();
            DpWireType t = FromSchemaTypeName(SchemaTypeToStandardString(f.Type));
            string proto = ToProtocolName(t);
            if (f.Type == DpSchemaType.Enum || (t == DpWireType.Int32 && typeName.EndsWith("_e")))
            {
                int dot = typeName.LastIndexOf('.');
                string shortName = dot >= 0 ? typeName.Substring(dot + 1) : typeName;
                return "enum<" + shortName + ">";
            }
            if (t == DpWireType.List || t == DpWireType.Set || t == DpWireType.Map)
                return proto + "<" + StripOuterGeneric(typeName) + ">";
            if (t == DpWireType.Struct && !string.IsNullOrEmpty(typeName) && typeName != "object")
                return typeName;
            return proto;
        }
    }

    public enum DpMessageType { Call = 1, Reply = 2, Exception = 3, Oneway = 4 }

    public interface DpProtocol
    {
        void WriteStructBegin(DpRecord structBegin);
        void WriteStructEnd();
        void WriteFieldBegin(DpColumn field);
        void WriteFieldEnd();
        void WriteFieldStop();
        void WriteBool(bool b);
        void WriteByte(byte b);
        void WriteI16(short i16);
        void WriteI32(int i32);
        void WriteI64(long i64);
        void WriteDouble(double d);
        void WriteString(string? s);
        void WriteBinary(byte[]? b);
        void WriteListBegin(DpList list);
        void WriteListEnd();
        void WriteSetBegin(DpSet set);
        void WriteSetEnd();
        void WriteMapBegin(DpDict map);
        void WriteMapEnd();
        DpRecord ReadStructBegin();
        void ReadStructEnd();
        DpColumn ReadFieldBegin();
        void ReadFieldEnd();
        bool ReadBool();
        byte ReadByte();
        short ReadI16();
        int ReadI32();
        long ReadI64();
        double ReadDouble();
        string ReadString();
        byte[] ReadBinary();
        DpList ReadListBegin();
        void ReadListEnd();
        DpSet ReadSetBegin();
        void ReadSetEnd();
        DpDict ReadMapBegin();
        void ReadMapEnd();
    }

    public struct DpRecord { public string Name; public DpRecord(string name) { Name = name; } }

    public struct DpColumn
    {
        public string Name;
        public DpWireType Type;
        public short ID;
        public DpColumn(string name, DpWireType type, short id) { Name = name; Type = type; ID = id; }
    }

    public struct DpList { public DpWireType ElementType; public int Count; }
    public struct DpSet { public DpWireType ElementType; public int Count; }
    public struct DpDict { public DpWireType KeyType; public DpWireType ValueType; public int Count; }
}
