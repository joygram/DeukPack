/**
 * DeukPack Protocol Core — 인터페이스·와이어 타입·스키마·타입명 유틸.
 * DpProtocolLibrary 모듈화: 공통 타입만 포함.
 */

using System;
using System.Collections.Generic;
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
        object Header { get; set; }
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
        public bool TryGetValue(long key, out IDeukPack value)
        {
            if (_inner.TryGetValue(key, out T v)) { value = v; return true; }
            value = null; return false;
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

    public enum DpSchemaType { Bool, Byte, I16, I32, I64, Double, String, Binary, Struct, Enum, List, Set, Map }

    public enum DpDefinitionKind { Struct, Enum, Typedef, Constant }

    public class DpFieldSchema
    {
        public int Id { get; set; }
        public int Order { get; set; }
        public string Name { get; set; }
        public DpSchemaType Type { get; set; }
        public string TypeName { get; set; }
        public bool Required { get; set; }
        public object DefaultValue { get; set; }
        public string DocComment { get; set; }
        public Dictionary<string, string> Annotations { get; set; }
    }

    public class DpSchema
    {
        public string Name { get; set; }
        public DpDefinitionKind Type { get; set; }
        public Dictionary<int, DpFieldSchema> Fields { get; set; }
        public string DocComment { get; set; }
        public Dictionary<string, string> Annotations { get; set; }
    }

    public enum DpWireType
    {
        Stop = 0, Void = 1, Bool = 2, Byte = 3, Double = 4, I16 = 6, I32 = 8, I64 = 10,
        String = 11, Binary = 11, Struct = 12, Map = 13, Set = 14, List = 15
    }

    public static class DpTypeNames
    {
        public static string ToProtocolName(DpWireType t)
        {
            switch (t)
            {
                case DpWireType.Bool: return "bool";
                case DpWireType.Byte: return "byte";
                case DpWireType.I16: return "int16";
                case DpWireType.I32: return "int32";
                case DpWireType.I64: return "int64";
                case DpWireType.Double: return "double";
                case DpWireType.String: return "string";
                case DpWireType.Struct: return "record";
                case DpWireType.List: return "list";
                case DpWireType.Set: return "set";
                case DpWireType.Map: return "map";
                default: return "string";
            }
        }

        public static DpWireType FromProtocolName(string dt)
        {
            if (string.IsNullOrEmpty(dt)) return DpWireType.String;
            string lower = dt.Trim().ToLowerInvariant();
            if (lower == "i64" || lower == "int64") return DpWireType.I64;
            if (lower == "i32" || lower == "int32") return DpWireType.I32;
            if (lower == "i16" || lower == "int16") return DpWireType.I16;
            if (lower == "i8" || lower == "int8" || lower == "byte") return DpWireType.Byte;
            if (lower == "str" || lower == "string") return DpWireType.String;
            if (lower == "dbl" || lower == "double") return DpWireType.Double;
            if (lower == "tf" || lower == "bool") return DpWireType.Bool;
            if (lower == "rec" || lower == "record") return DpWireType.Struct;
            if (lower.StartsWith("lst") || lower.StartsWith("list")) return DpWireType.List;
            if (lower.StartsWith("set")) return DpWireType.Set;
            if (lower.StartsWith("map")) return DpWireType.Map;
            if (lower.StartsWith("enum")) return DpWireType.I32;
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
                case "Bool": return DpWireType.Bool;
                case "Byte": return DpWireType.Byte;
                case "I16": return DpWireType.I16;
                case "I32": return DpWireType.I32;
                case "I64": return DpWireType.I64;
                case "Double": return DpWireType.Double;
                case "String":
                case "Binary": return DpWireType.String;
                case "Struct": return DpWireType.Struct;
                case "List": return DpWireType.List;
                case "Set": return DpWireType.Set;
                case "Map": return DpWireType.Map;
                case "Enum": return DpWireType.I32;
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
            DpWireType t = FromSchemaTypeName(f.Type.ToString());
            string proto = ToProtocolName(t);
            if (f.Type == DpSchemaType.Enum || (t == DpWireType.I32 && typeName.EndsWith("_e")))
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
        void WriteString(string s);
        void WriteBinary(byte[] b);
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
