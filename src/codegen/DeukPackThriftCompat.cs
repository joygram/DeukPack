/**
 * DeukPack.Protocol compatibility: T* and Thrift* type names for existing generated code and add-in.
 * New code should use Dp* types (DpProtocol, DpWireType, DpRecord, DpColumn, DpSchema, etc.).
 * See docs/DEUKPACK_CORE_VS_APACHE_AND_OTHERS.md §5.
 */

using System;

namespace DeukPack.Protocol
{
#pragma warning disable CS0618 // Type or member is obsolete

    [Obsolete("Use DpWireType")]
    public enum TType
    {
        Stop = 0, Void = 1, Bool = 2, Byte = 3, Double = 4,
        I16 = 6, I32 = 8, I64 = 10, String = 11, Struct = 12, Map = 13, Set = 14, List = 15
    }

    [Obsolete("Use DpProtocol")]
    public interface TProtocol : DpProtocol { }

    [Obsolete("Use DpRecord")]
    public struct TStruct
    {
        public string Name;
        public TStruct(string name) { Name = name; }
        public static implicit operator TStruct(DpRecord r) => new TStruct(r.Name);
        public static implicit operator DpRecord(TStruct t) => new DpRecord(t.Name);
    }

    [Obsolete("Use DpColumn")]
    public struct TField
    {
        public string Name;
        public TType Type;
        public short ID;
        public TField(string name, TType type, short id) { Name = name; Type = type; ID = id; }
        public static implicit operator TField(DpColumn c) => new TField(c.Name, (TType)(int)c.Type, c.ID);
        public static implicit operator DpColumn(TField t) => new DpColumn(t.Name, (DpWireType)(int)t.Type, t.ID);
    }

    [Obsolete("Use DpList")]
    public struct TList
    {
        public TType ElementType;
        public int Count;
        public static implicit operator TList(DpList l) => new TList { ElementType = (TType)(int)l.ElementType, Count = l.Count };
        public static implicit operator DpList(TList t) => new DpList { ElementType = (DpWireType)(int)t.ElementType, Count = t.Count };
    }

    [Obsolete("Use DpSet")]
    public struct TSet
    {
        public TType ElementType;
        public int Count;
        public static implicit operator TSet(DpSet s) => new TSet { ElementType = (TType)(int)s.ElementType, Count = s.Count };
        public static implicit operator DpSet(TSet t) => new DpSet { ElementType = (DpWireType)(int)t.ElementType, Count = t.Count };
    }

    [Obsolete("Use DpDict")]
    public struct TMap
    {
        public TType KeyType;
        public TType ValueType;
        public int Count;
        public static implicit operator TMap(DpDict d) => new TMap { KeyType = (TType)(int)d.KeyType, ValueType = (TType)(int)d.ValueType, Count = d.Count };
        public static implicit operator DpDict(TMap t) => new DpDict { KeyType = (DpWireType)(int)t.KeyType, ValueType = (DpWireType)(int)t.ValueType, Count = t.Count };
    }

    [Obsolete("Use DpProtocolUtil")]
    public static class TProtocolUtil
    {
        public static void Skip(TProtocol prot, TType type) => DpProtocolUtil.Skip(prot, (DpWireType)(int)type);
    }

    [Obsolete("Use DpSchemaType")]
    public enum ThriftType
    {
        Bool, Byte, I16, I32, I64, Double, String, Binary, Struct, Enum, List, Set, Map
    }

    [Obsolete("Use DpDefinitionKind")]
    public enum ThriftSchemaType
    {
        Struct, Enum, Typedef, Constant
    }

    [Obsolete("Use DpFieldSchema")]
    public class ThriftFieldSchema
    {
        public int Id { get; set; }
        public int Order { get; set; }
        public string Name { get; set; }
        public ThriftType Type { get; set; }
        public string TypeName { get; set; }
        public bool Required { get; set; }
        public object DefaultValue { get; set; }
        public string DocComment { get; set; }
        public System.Collections.Generic.Dictionary<string, string> Annotations { get; set; }
        public DpFieldSchema ToDpFieldSchema() => new DpFieldSchema
        {
            Id = Id, Order = Order, Name = Name, Type = (DpSchemaType)(int)Type, TypeName = TypeName,
            Required = Required, DefaultValue = DefaultValue, DocComment = DocComment, Annotations = Annotations
        };
    }

    [Obsolete("Use DpSchema")]
    public class ThriftSchema
    {
        public string Name { get; set; }
        public ThriftSchemaType Type { get; set; }
        public System.Collections.Generic.Dictionary<int, ThriftFieldSchema> Fields { get; set; }
        public string DocComment { get; set; }
        public System.Collections.Generic.Dictionary<string, string> Annotations { get; set; }
        public DpSchema ToDpSchema()
        {
            var fs = new System.Collections.Generic.Dictionary<int, DpFieldSchema>();
            if (Fields != null)
                foreach (var kv in Fields)
                    fs[kv.Key] = kv.Value.ToDpFieldSchema();
            return new DpSchema
            {
                Name = Name,
                Type = (DpDefinitionKind)(int)Type,
                Fields = fs,
                DocComment = DocComment,
                Annotations = Annotations
            };
        }
    }

    [Obsolete("Use DpTypeNames")]
    public static class ThriftProtocolTypeNames
    {
        public static string ToProtocolName(TType t) => DpTypeNames.ToProtocolName((DpWireType)(int)t);
        public static DpWireType FromProtocolName(string dt) => DpTypeNames.FromProtocolName(dt);
        public static bool IsContainerType(TType t) => DpTypeNames.IsContainerType((DpWireType)(int)t);
        public static DpWireType FromSchemaTypeName(string name) => DpTypeNames.FromSchemaTypeName(name);
        public static string StripOuterGeneric(string typeName) => DpTypeNames.StripOuterGeneric(typeName);
        public static string SchemaFieldToDataType(ThriftFieldSchema f) => f == null ? "string" : DpTypeNames.SchemaFieldToDataType(f.ToDpFieldSchema());
    }

    // TExcelProtocol moved to DeukPack.ExcelProtocol DLL (DpExcelCompat.cs)

#pragma warning restore CS0618
}
