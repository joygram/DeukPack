/**
 * DeukPackSerializer — 직렬화 헬퍼. DpProtocolLibrary 모듈화.
 */
#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
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
        /// <summary>내부 <see cref="MemoryStream"/> 을 둔 바이너리 팩 프로토콜 (쓰기 후 <see cref="DpBinaryProtocol.ToBytes"/>).</summary>
        public static DpBinaryProtocol OpenBinaryPack()
            => new DpBinaryProtocol();

        /// <summary>바이너리 와이어 — 스트림에 팩(쓰기).</summary>
        public static DpBinaryProtocol OpenBinaryPack(Stream stream, bool bigEndian = true, bool strictRead = true, bool strictWrite = true, int initialBufferSize = 4096)
            => new DpBinaryProtocol(stream, bigEndian, strictRead, strictWrite, initialBufferSize);

        /// <summary>바이너리 와이어 — 스트림에서 언팩(읽기). 타입은 <see cref="OpenBinaryPack(Stream, bool, bool, bool, int)"/> 과 동일.</summary>
        public static DpBinaryProtocol OpenBinaryUnpack(Stream stream, bool bigEndian = true, bool strictRead = true, bool strictWrite = true, int initialBufferSize = 4096)
            => new DpBinaryProtocol(stream, bigEndian, strictRead, strictWrite, initialBufferSize);

        /// <summary>객체 전체를 byte[] 로 팩. <see cref="Serialize"/> 와 동일.</summary>
        public static byte[] Pack(IDpSerializable obj, DpFormat format = DpFormat.Binary, bool pretty = false)
            => Serialize(obj, format, pretty);

        /// <summary>byte[] 를 객체로 언팩. <see cref="Deserialize{T}"/> 와 동일.</summary>
        public static T Unpack<T>(byte[] data, DpFormat format = DpFormat.Binary) where T : IDpSerializable, new()
            => Deserialize<T>(data, format);

        /// <summary>
        /// Write a value recursively based on its type
        /// </summary>
        public static void WriteValue(DpProtocol oprot, DpWireType type, object? value)
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
                case DpWireType.Int16:
                    oprot.WriteI16(value is short s16 ? s16 : Convert.ToInt16(value));
                    break;
                case DpWireType.Int32: // U32 동일 와이어(§2.2.1)
                    if (value is int i32) oprot.WriteI32(i32);
                    else if (value is uint u32) oprot.WriteI32(unchecked((int)u32));
                    else oprot.WriteI32(Convert.ToInt32(value));
                    break;
                case DpWireType.Int64: // U64 동일 와이어
                    if (value is long i64) oprot.WriteI64(i64);
                    else if (value is ulong u64) oprot.WriteI64(unchecked((long)u64));
                    else oprot.WriteI64(Convert.ToInt64(value));
                    break;
                case DpWireType.Double:
                    oprot.WriteDouble((double)value);
                    break;
                case DpWireType.String:
                    if (value is byte[] bytes)
                        oprot.WriteBinary(bytes);
                    else
                        oprot.WriteString(value as string);
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
        public static object? ReadValue(DpProtocol iprot, DpWireType type, Type? targetType = null)
        {
            switch (type)
            {
                case DpWireType.Bool:
                    return iprot.ReadBool();
                case DpWireType.Byte:
                    return iprot.ReadByte();
                case DpWireType.Int16:
                {
                    short v = iprot.ReadI16();
                    return (targetType != null && targetType.IsEnum) ? Enum.ToObject(targetType, v) : (object)v;
                }
                case DpWireType.Int32:
                {
                    int v = iprot.ReadI32();
                    if (targetType != null && targetType.IsEnum) return Enum.ToObject(targetType, v);
                    if (targetType == typeof(uint)) return unchecked((uint)v);
                    return v;
                }
                case DpWireType.Int64:
                {
                    long v = iprot.ReadI64();
                    if (targetType != null && targetType.IsEnum) return Enum.ToObject(targetType, v);
                    if (targetType == typeof(ulong)) return unchecked((ulong)v);
                    return v;
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
        public static void WriteList<T>(DpProtocol oprot, DpWireType elementType, IEnumerable<T>? list)
        {
            if (list == null) return;
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
        public static List<T> ReadList<T>(DpProtocol iprot, DpWireType elementType, Func<DpProtocol, T>? reader = null)
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
        public static HashSet<T> ReadSet<T>(DpProtocol iprot, DpWireType elementType, Func<DpProtocol, T>? reader = null)
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
            Func<DpProtocol, TKey>? keyReader = null,
            Func<DpProtocol, TValue>? valueReader = null)
        where TKey : notnull
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

        /// <summary>득팩 프로토콜 포맷</summary>
        public enum DpFormat { Binary, Json, DeukJson }

        /// <summary>득팩 객체 → byte[] (기본: Binary, pretty: JSON 프리티어 옵션)</summary>
        public static byte[] Serialize(IDpSerializable obj, DpFormat format = DpFormat.Binary, bool pretty = false)
        {
            var ms = new System.IO.MemoryStream();
            DpProtocol p = CreateProtocol(ms, format, pretty);
            obj.Write(p);
            return ms.ToArray();
        }

        /// <summary>byte[] → 득팩 객체 (기본: Binary)</summary>
        public static T Deserialize<T>(byte[] data, DpFormat format = DpFormat.Binary) where T : IDpSerializable, new()
        {
            var ms = new System.IO.MemoryStream(data);
            DpProtocol p = CreateProtocol(ms, format, false);
            var obj = new T();
            obj.Read(p);
            return obj;
        }

        /// <summary>객체를 JSON 문자열로 덤프 (디버깅/덤프용)</summary>
        public static string ToString(IDpSerializable obj, bool pretty = true)
        {
            var bytes = Serialize(obj, DpFormat.Json, pretty);
            return System.Text.Encoding.UTF8.GetString(bytes);
        }

        private static DpProtocol CreateProtocol(System.IO.Stream stream, DpFormat format, bool pretty)
        {
            switch (format)
            {
                case DpFormat.Json:
                    return new DpJsonProtocol(stream, pretty);
                case DpFormat.DeukJson:
                    return new DpDeukJsonProtocol(stream, pretty);
                case DpFormat.Binary:
                default:
                    return OpenBinaryPack(stream);
            }
        }
    }
}
