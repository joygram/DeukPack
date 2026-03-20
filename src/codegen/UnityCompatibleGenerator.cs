/**
 * Unity-Compatible C# Generator for DeukPack
 * Unity DLL 호환성을 위한 C# 코드 생성기
 */

using System;
using System.Collections.Generic;
using System.Text;
using System.IO;

namespace DeukPack.Unity
{
    /// <summary>
    /// Unity 호환 Thrift 프로토콜 라이브러리
    /// Unity 2020.3+ 지원
    /// </summary>
    public enum TType : byte
    {
        Stop = 0,
        Void = 1,
        Bool = 2,
        Byte = 3,
        Double = 4,
        I16 = 6,
        I32 = 8,
        I64 = 10,
        String = 11,
        Binary = 11,
        Struct = 12,
        Map = 13,
        Set = 14,
        List = 15
    }

    /// <summary>
    /// Unity 호환 Thrift 메시지 타입
    /// </summary>
    public enum TMessageType : byte
    {
        Call = 1,
        Reply = 2,
        Exception = 3,
        Oneway = 4
    }

    /// <summary>
    /// Unity 호환 Thrift 구조체 정보
    /// </summary>
    [System.Serializable]
    public struct TStruct
    {
        public string Name;
        
        public TStruct(string name)
        {
            Name = name;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 필드 정보
    /// </summary>
    [System.Serializable]
    public struct TField
    {
        public string Name;
        public TType Type;
        public short ID;
        
        public TField(string name, TType type, short id)
        {
            Name = name;
            Type = type;
            ID = id;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 리스트 정보
    /// </summary>
    [System.Serializable]
    public struct TList
    {
        public TType ElementType;
        public int Count;
        
        public TList(TType elementType, int count)
        {
            ElementType = elementType;
            Count = count;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 셋 정보
    /// </summary>
    [System.Serializable]
    public struct TSet
    {
        public TType ElementType;
        public int Count;
        
        public TSet(TType elementType, int count)
        {
            ElementType = elementType;
            Count = count;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 맵 정보
    /// </summary>
    [System.Serializable]
    public struct TMap
    {
        public TType KeyType;
        public TType ValueType;
        public int Count;
        
        public TMap(TType keyType, TType valueType, int count)
        {
            KeyType = keyType;
            ValueType = valueType;
            Count = count;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 프로토콜 인터페이스
    /// </summary>
    public interface TProtocol
    {
        void WriteStructBegin(TStruct structBegin);
        void WriteStructEnd();
        void WriteFieldBegin(TField field);
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
        void WriteListBegin(TList list);
        void WriteListEnd();
        void WriteSetBegin(TSet set);
        void WriteSetEnd();
        void WriteMapBegin(TMap map);
        void WriteMapEnd();

        TStruct ReadStructBegin();
        void ReadStructEnd();
        TField ReadFieldBegin();
        void ReadFieldEnd();
        bool ReadBool();
        byte ReadByte();
        short ReadI16();
        int ReadI32();
        long ReadI64();
        double ReadDouble();
        string ReadString();
        byte[] ReadBinary();
        TList ReadListBegin();
        void ReadListEnd();
        TSet ReadSetBegin();
        void ReadSetEnd();
        TMap ReadMapBegin();
        void ReadMapEnd();
    }

    /// <summary>
    /// Unity 호환 바이너리 프로토콜
    /// Unity의 메모리 관리에 최적화
    /// </summary>
    public class TBinaryProtocol : TProtocol
    {
        private byte[] _buffer;
        private int _offset;
        private bool _strictRead;
        private bool _strictWrite;

        public TBinaryProtocol(byte[] buffer, bool strictRead = true, bool strictWrite = true)
        {
            _buffer = buffer;
            _offset = 0;
            _strictRead = strictRead;
            _strictWrite = strictWrite;
        }

        public void WriteStructBegin(TStruct structBegin)
        {
            // Binary protocol doesn't write struct names
        }

        public void WriteStructEnd()
        {
            // Binary protocol doesn't write struct end markers
        }

        public void WriteFieldBegin(TField field)
        {
            WriteByte((byte)field.Type);
            WriteI16(field.ID);
        }

        public void WriteFieldEnd()
        {
            // Binary protocol doesn't write field end markers
        }

        public void WriteFieldStop()
        {
            WriteByte((byte)TType.Stop);
        }

        public void WriteBool(bool b)
        {
            WriteByte(b ? (byte)1 : (byte)0);
        }

        public void WriteByte(byte b)
        {
            if (_offset >= _buffer.Length)
            {
                Array.Resize(ref _buffer, _buffer.Length * 2);
            }
            _buffer[_offset++] = b;
        }

        public void WriteI16(short i16)
        {
            byte[] bytes = BitConverter.GetBytes(i16);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            WriteBytes(bytes);
        }

        public void WriteI32(int i32)
        {
            byte[] bytes = BitConverter.GetBytes(i32);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            WriteBytes(bytes);
        }

        public void WriteI64(long i64)
        {
            byte[] bytes = BitConverter.GetBytes(i64);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            WriteBytes(bytes);
        }

        public void WriteDouble(double d)
        {
            byte[] bytes = BitConverter.GetBytes(d);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            WriteBytes(bytes);
        }

        public void WriteString(string s)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(s);
            WriteI32(bytes.Length);
            WriteBytes(bytes);
        }

        public void WriteBinary(byte[] b)
        {
            WriteI32(b.Length);
            WriteBytes(b);
        }

        public void WriteListBegin(TList list)
        {
            WriteByte((byte)list.ElementType);
            WriteI32(list.Count);
        }

        public void WriteListEnd()
        {
            // Binary protocol doesn't write list end markers
        }

        public void WriteSetBegin(TSet set)
        {
            WriteByte((byte)set.ElementType);
            WriteI32(set.Count);
        }

        public void WriteSetEnd()
        {
            // Binary protocol doesn't write set end markers
        }

        public void WriteMapBegin(TMap map)
        {
            WriteByte((byte)map.KeyType);
            WriteByte((byte)map.ValueType);
            WriteI32(map.Count);
        }

        public void WriteMapEnd()
        {
            // Binary protocol doesn't write map end markers
        }

        public TStruct ReadStructBegin()
        {
            return new TStruct();
        }

        public void ReadStructEnd()
        {
            // Binary protocol doesn't read struct end markers
        }

        public TField ReadFieldBegin()
        {
            byte type = ReadByte();
            if (type == (byte)TType.Stop)
            {
                return new TField("", TType.Stop, 0);
            }
            short id = ReadI16();
            return new TField("", (TType)type, id);
        }

        public void ReadFieldEnd()
        {
            // Binary protocol doesn't read field end markers
        }

        public bool ReadBool()
        {
            return ReadByte() != 0;
        }

        public byte ReadByte()
        {
            if (_offset >= _buffer.Length)
            {
                throw new EndOfStreamException();
            }
            return _buffer[_offset++];
        }

        public short ReadI16()
        {
            byte[] bytes = ReadBytes(2);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            return BitConverter.ToInt16(bytes, 0);
        }

        public int ReadI32()
        {
            byte[] bytes = ReadBytes(4);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            return BitConverter.ToInt32(bytes, 0);
        }

        public long ReadI64()
        {
            byte[] bytes = ReadBytes(8);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            return BitConverter.ToInt64(bytes, 0);
        }

        public double ReadDouble()
        {
            byte[] bytes = ReadBytes(8);
            if (!BitConverter.IsLittleEndian)
            {
                Array.Reverse(bytes);
            }
            return BitConverter.ToDouble(bytes, 0);
        }

        public string ReadString()
        {
            int length = ReadI32();
            byte[] bytes = ReadBytes(length);
            return Encoding.UTF8.GetString(bytes);
        }

        public byte[] ReadBinary()
        {
            int length = ReadI32();
            return ReadBytes(length);
        }

        public TList ReadListBegin()
        {
            byte elementType = ReadByte();
            int count = ReadI32();
            return new TList((TType)elementType, count);
        }

        public void ReadListEnd()
        {
            // Binary protocol doesn't read list end markers
        }

        public TSet ReadSetBegin()
        {
            byte elementType = ReadByte();
            int count = ReadI32();
            return new TSet((TType)elementType, count);
        }

        public void ReadSetEnd()
        {
            // Binary protocol doesn't read set end markers
        }

        public TMap ReadMapBegin()
        {
            byte keyType = ReadByte();
            byte valueType = ReadByte();
            int count = ReadI32();
            return new TMap((TType)keyType, (TType)valueType, count);
        }

        public void ReadMapEnd()
        {
            // Binary protocol doesn't read map end markers
        }

        private void WriteBytes(byte[] bytes)
        {
            if (_offset + bytes.Length > _buffer.Length)
            {
                Array.Resize(ref _buffer, Math.Max(_buffer.Length * 2, _offset + bytes.Length));
            }
            Array.Copy(bytes, 0, _buffer, _offset, bytes.Length);
            _offset += bytes.Length;
        }

        private byte[] ReadBytes(int count)
        {
            if (_offset + count > _buffer.Length)
            {
                throw new EndOfStreamException();
            }
            byte[] result = new byte[count];
            Array.Copy(_buffer, _offset, result, 0, count);
            _offset += count;
            return result;
        }

        // Unity 호환성 메서드
        public byte[] GetBuffer()
        {
            byte[] result = new byte[_offset];
            Array.Copy(_buffer, 0, result, 0, _offset);
            return result;
        }

        public int GetOffset()
        {
            return _offset;
        }

        public void SetOffset(int offset)
        {
            _offset = offset;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 프로토콜 유틸리티
    /// </summary>
    public static class TProtocolUtil
    {
        public static void Skip(TProtocol prot, TType type)
        {
            switch (type)
            {
                case TType.Bool:
                    prot.ReadBool();
                    break;
                case TType.Byte:
                    prot.ReadByte();
                    break;
                case TType.I16:
                    prot.ReadI16();
                    break;
                case TType.I32:
                    prot.ReadI32();
                    break;
                case TType.I64:
                    prot.ReadI64();
                    break;
                case TType.Double:
                    prot.ReadDouble();
                    break;
                case TType.String:
                    prot.ReadBinary();
                    break;
                case TType.List:
                    var list = prot.ReadListBegin();
                    for (int i = 0; i < list.Count; i++)
                    {
                        Skip(prot, list.ElementType);
                    }
                    prot.ReadListEnd();
                    break;
                case TType.Set:
                    var set = prot.ReadSetBegin();
                    for (int i = 0; i < set.Count; i++)
                    {
                        Skip(prot, set.ElementType);
                    }
                    prot.ReadSetEnd();
                    break;
                case TType.Map:
                    var map = prot.ReadMapBegin();
                    for (int i = 0; i < map.Count; i++)
                    {
                        Skip(prot, map.KeyType);
                        Skip(prot, map.ValueType);
                    }
                    prot.ReadMapEnd();
                    break;
                case TType.Struct:
                    prot.ReadStructBegin();
                    while (true)
                    {
                        var field = prot.ReadFieldBegin();
                        if (field.Type == TType.Stop)
                        {
                            break;
                        }
                        Skip(prot, field.Type);
                        prot.ReadFieldEnd();
                    }
                    prot.ReadStructEnd();
                    break;
            }
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 직렬화 헬퍼
    /// Unity의 메모리 관리에 최적화
    /// </summary>
    public static class ThriftSerializer
    {
        private static readonly byte[] _tempBuffer = new byte[1024 * 1024]; // 1MB temp buffer

        public static byte[] Serialize<T>(T obj) where T : IThriftSerializable
        {
            var protocol = new TBinaryProtocol(_tempBuffer, true, true);
            obj.Write(protocol);
            return protocol.GetBuffer();
        }

        public static T Deserialize<T>(byte[] data) where T : IThriftSerializable, new()
        {
            var protocol = new TBinaryProtocol(data, true, true);
            var obj = new T();
            obj.Read(protocol);
            return obj;
        }
    }

    /// <summary>
    /// Unity 호환 Thrift 직렬화 인터페이스
    /// </summary>
    public interface IThriftSerializable
    {
        void Write(TProtocol oprot);
        void Read(TProtocol iprot);
    }
}
