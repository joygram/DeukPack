/**
 * DeukPackSerializer — 직렬화 헬퍼. DpProtocolLibrary 모듈화.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace DeukPack.Protocol
{
    /// <summary>
    /// DeukPack serialization helper - modularized to reduce code duplication
    /// Recursive serialization support for nested structures
    /// </summary>
    public static class DeukPackSerializer
    {
        /// <summary>
        /// Write a value recursively based on its type
        /// </summary>
        public static void WriteValue(DpProtocol oprot, DpWireType type, object value)
        {
            if (value == null)
                return;

            switch (type)
            {
                case DpWireType.Bool:
                    oprot.WriteBool((bool)value);
                    break;
                case DpWireType.Byte:
                    oprot.WriteByte((byte)value);
                    break;
                case DpWireType.I16:
                    oprot.WriteI16(value is short s16 ? s16 : Convert.ToInt16(value));
                    break;
                case DpWireType.I32:
                    oprot.WriteI32(value is int i32 ? i32 : Convert.ToInt32(value));
                    break;
                case DpWireType.I64:
                    oprot.WriteI64(value is long i64 ? i64 : Convert.ToInt64(value));
                    break;
                case DpWireType.Double:
                    oprot.WriteDouble((double)value);
                    break;
                case DpWireType.String:
                    if (value is byte[] bytes)
                        oprot.WriteBinary(bytes);
                    else
                        oprot.WriteString((string)value);
                    break;
                case DpWireType.Struct:
                    if (value is IDpSerializable serializable)
                        serializable.Write(oprot);
                    break;
                default:
                    if (value is IDpSerializable serializableValue)
                        serializableValue.Write(oprot);
                    break;
            }
        }

        /// <summary>
        /// Read a value recursively based on its type
        /// </summary>
        public static object ReadValue(DpProtocol iprot, DpWireType type, Type targetType = null)
        {
            switch (type)
            {
                case DpWireType.Bool:
                    return iprot.ReadBool();
                case DpWireType.Byte:
                    return iprot.ReadByte();
                case DpWireType.I16:
                {
                    short v = iprot.ReadI16();
                    return (targetType != null && targetType.IsEnum) ? Enum.ToObject(targetType, v) : (object)v;
                }
                case DpWireType.I32:
                {
                    int v = iprot.ReadI32();
                    return (targetType != null && targetType.IsEnum) ? Enum.ToObject(targetType, v) : (object)v;
                }
                case DpWireType.I64:
                {
                    long v = iprot.ReadI64();
                    return (targetType != null && targetType.IsEnum) ? Enum.ToObject(targetType, v) : (object)v;
                }
                case DpWireType.Double:
                    return iprot.ReadDouble();
                case DpWireType.String:
                    if (targetType == typeof(string))
                        return iprot.ReadString();
                    return iprot.ReadBinary();
                case DpWireType.Struct:
                    if (targetType != null)
                    {
                        var instance = Activator.CreateInstance(targetType);
                        if (instance is IDpSerializable serializable)
                        {
                            serializable.Read(iprot);
                            return instance;
                        }
                    }
                    return null;
                default:
                    if (targetType != null)
                    {
                        var instance = Activator.CreateInstance(targetType);
                        if (instance is IDpSerializable serializable)
                        {
                            serializable.Read(iprot);
                            return instance;
                        }
                    }
                    return null;
            }
        }

        /// <summary>
        /// Write a list recursively
        /// </summary>
        public static void WriteList<T>(DpProtocol oprot, DpWireType elementType, IEnumerable<T> list)
        {
            var count = list is ICollection<T> collection ? collection.Count : list.Count();
            oprot.WriteListBegin(new DpList { ElementType = elementType, Count = count });
            foreach (var item in list)
            {
                WriteValue(oprot, elementType, item);
            }
            oprot.WriteListEnd();
        }

        /// <summary>
        /// Read a list recursively
        /// </summary>
        public static List<T> ReadList<T>(DpProtocol iprot, DpWireType elementType, Func<DpProtocol, T> reader = null)
        {
            var listInfo = iprot.ReadListBegin();
            var list = new List<T>(listInfo.Count);
            for (int i = 0; i < listInfo.Count; i++)
            {
                if (reader != null)
                {
                    list.Add(reader(iprot));
                }
                else
                {
                    var value = ReadValue(iprot, elementType, typeof(T));
                    if (value is T item)
                    {
                        list.Add(item);
                    }
                }
            }
            iprot.ReadListEnd();
            return list;
        }

        /// <summary>
        /// Write a set recursively
        /// </summary>
        public static void WriteSet<T>(DpProtocol oprot, DpWireType elementType, IEnumerable<T> set)
        {
            var count = set is ICollection<T> collection ? collection.Count : set.Count();
            oprot.WriteSetBegin(new DpSet { ElementType = elementType, Count = count });
            foreach (var item in set)
            {
                WriteValue(oprot, elementType, item);
            }
            oprot.WriteSetEnd();
        }

        /// <summary>
        /// Read a set recursively
        /// </summary>
        public static HashSet<T> ReadSet<T>(DpProtocol iprot, DpWireType elementType, Func<DpProtocol, T> reader = null)
        {
            var setInfo = iprot.ReadSetBegin();
            var set = new HashSet<T>();
            for (int i = 0; i < setInfo.Count; i++)
            {
                if (reader != null)
                {
                    set.Add(reader(iprot));
                }
                else
                {
                    var value = ReadValue(iprot, elementType, typeof(T));
                    if (value is T item)
                    {
                        set.Add(item);
                    }
                }
            }
            iprot.ReadSetEnd();
            return set;
        }

        /// <summary>
        /// Write a map recursively
        /// </summary>
        public static void WriteMap<TKey, TValue>(DpProtocol oprot, DpWireType keyType, DpWireType valueType, IDictionary<TKey, TValue> map)
        {
            oprot.WriteMapBegin(new DpDict { KeyType = keyType, ValueType = valueType, Count = map.Count });
            foreach (var kvp in map)
            {
                WriteValue(oprot, keyType, kvp.Key);
                WriteValue(oprot, valueType, kvp.Value);
            }
            oprot.WriteMapEnd();
        }

        /// <summary>
        /// Read a map recursively
        /// </summary>
        public static Dictionary<TKey, TValue> ReadMap<TKey, TValue>(
            DpProtocol iprot,
            DpWireType keyType,
            DpWireType valueType,
            Func<DpProtocol, TKey> keyReader = null,
            Func<DpProtocol, TValue> valueReader = null)
        {
            var mapInfo = iprot.ReadMapBegin();
            var map = new Dictionary<TKey, TValue>(mapInfo.Count);
            for (int i = 0; i < mapInfo.Count; i++)
            {
                TKey key;
                if (keyReader != null)
                {
                    key = keyReader(iprot);
                }
                else
                {
                    var keyValue = ReadValue(iprot, keyType, typeof(TKey));
                    key = keyValue is TKey k ? k : default(TKey);
                }

                TValue value;
                if (valueReader != null)
                {
                    value = valueReader(iprot);
                }
                else
                {
                    var valueObj = ReadValue(iprot, valueType, typeof(TValue));
                    value = valueObj is TValue v ? v : default(TValue);
                }

                map[key] = value;
            }
            iprot.ReadMapEnd();
            return map;
        }
    }
}
