#nullable enable
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

namespace DeukPack.Protocol
{
    /// <summary>
    /// DeukPack Pack Protocol for C# (Tagged LE binary)
    /// Ported from Java implementation.
    /// </summary>
    public class DpPackProtocol : DpProtocol
    {
        private readonly Stream? _input;
        private readonly Stream? _output;
        private readonly Stack<int> _fieldCounts = new Stack<int>();

        public enum PackTag : byte
        {
            Null = 0, False = 1, True = 2, Int32 = 3, Int64 = 4, Double = 5, String = 6, Binary = 7, Array = 8, Map = 9, Object = 10
        }

        public DpPackProtocol(Stream stream)
        {
            if (stream.CanRead) _input = stream;
            if (stream.CanWrite) _output = stream;
        }

        public DpPackProtocol(Stream input, Stream output)
        {
            _input = input;
            _output = output;
        }

        private void WriteTag(PackTag tag)
        {
            _output?.WriteByte((byte)tag);
        }

        private byte ReadRawByte()
        {
            if (_input == null) throw new InvalidOperationException("Input stream is null");
            int b = _input.ReadByte();
            if (b == -1) throw new EndOfStreamException();
            return (byte)b;
        }

        private void WriteRawI32(int v)
        {
            if (_output == null) return;
            _output.WriteByte((byte)(v & 0xFF));
            _output.WriteByte((byte)((v >> 8) & 0xFF));
            _output.WriteByte((byte)((v >> 16) & 0xFF));
            _output.WriteByte((byte)((v >> 24) & 0xFF));
        }

        private int ReadRawI32()
        {
            int b1 = ReadRawByte();
            int b2 = ReadRawByte();
            int b3 = ReadRawByte();
            int b4 = ReadRawByte();
            int v = (b1 & 0xFF) | ((b2 & 0xFF) << 8) | ((b3 & 0xFF) << 16) | ((b4 & 0xFF) << 24);
            // Console.WriteLine($"ReadRawI32: {v}");
            return v;
        }

        private void WriteRawI64(long v)
        {
            if (_output == null) return;
            for (int i = 0; i < 8; i++)
            {
                _output.WriteByte((byte)(v & 0xFF));
                v >>= 8;
            }
        }

        private long ReadRawI64()
        {
            long v = 0;
            for (int i = 0; i < 8; i++)
            {
                v |= ((long)(ReadRawByte() & 0xFF)) << (8 * i);
            }
            return v;
        }

        public void WriteStructBegin(DpRecord record)
        {
            WriteTag(PackTag.Object);
            WriteRawI32(record.Count);
        }

        public void WriteStructEnd() { }

        public void WriteFieldBegin(DpColumn column)
        {
            WriteRawString(column.Name);
        }

        public void WriteFieldEnd() { }

        public void WriteFieldStop() { }

        public void WriteMapBegin(DpDict dict)
        {
            WriteTag(PackTag.Map);
            WriteRawI32(dict.Count);
        }

        public void WriteMapEnd() { }

        public void WriteListBegin(DpList list)
        {
            WriteTag(PackTag.Array);
            WriteRawI32(list.Count);
        }

        public void WriteListEnd() { }

        public void WriteSetBegin(DpSet set)
        {
            WriteTag(PackTag.Array);
            WriteRawI32(set.Count);
        }

        public void WriteSetEnd() { }

        public void WriteBool(bool value)
        {
            WriteTag(value ? PackTag.True : PackTag.False);
        }

        public void WriteByte(byte value)
        {
            WriteTag(PackTag.Int32);
            WriteRawI32(value);
        }

        public void WriteI16(short value)
        {
            WriteTag(PackTag.Int32);
            WriteRawI32(value);
        }

        public void WriteI32(int value)
        {
            WriteTag(PackTag.Int32);
            WriteRawI32(value);
        }

        public void WriteI64(long value)
        {
            WriteTag(PackTag.Int64);
            WriteRawI64(value);
        }

        public void WriteDouble(double value)
        {
            WriteTag(PackTag.Double);
            WriteRawI64(BitConverter.DoubleToInt64Bits(value));
        }

        public void WriteString(string? value)
        {
            if (value == null)
            {
                WriteTag(PackTag.Null);
                return;
            }
            WriteTag(PackTag.String);
            WriteRawString(value);
        }

        private void WriteRawString(string v)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(v);
            WriteRawI32(bytes.Length);
            _output?.Write(bytes, 0, bytes.Length);
        }

        public void WriteBinary(byte[]? value)
        {
            if (value == null)
            {
                WriteTag(PackTag.Null);
                return;
            }
            WriteTag(PackTag.Binary);
            WriteRawI32(value.Length);
            _output?.Write(value, 0, value.Length);
        }

        public DpRecord ReadStructBegin()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag != PackTag.Object) throw new Exception("Expected Object tag");
            int count = ReadRawI32();
            _fieldCounts.Push(count);
            return new DpRecord();
        }

        public void ReadStructEnd() { }

        public DpColumn ReadFieldBegin()
        {
            if (_fieldCounts.Count == 0) return new DpColumn("", DpWireType.Stop, 0);
            int count = _fieldCounts.Peek();
            if (count <= 0)
            {
                _fieldCounts.Pop();
                return new DpColumn("", DpWireType.Stop, 0);
            }
            _fieldCounts.Pop();
            _fieldCounts.Push(count - 1);
            return new DpColumn(ReadRawString(), DpWireType.Void, 0);
        }

        private string ReadRawString()
        {
            int length = ReadRawI32();
            Console.WriteLine($"[DEBUG] ReadRawString length: {length} at offset {(_input as System.IO.MemoryStream)?.Position}");
            byte[] bytes = new byte[length];
            ReadAll(bytes);
            return Encoding.UTF8.GetString(bytes);
        }

        private void ReadAll(byte[] b)
        {
            int off = 0;
            while (off < b.Length)
            {
                int count = _input?.Read(b, off, b.Length - off) ?? 0;
                if (count <= 0) throw new EndOfStreamException();
                off += count;
            }
        }

        public void ReadFieldEnd() { }

        public DpDict ReadMapBegin()
        {
            if ((PackTag)ReadRawByte() != PackTag.Map) throw new Exception("Expected Map tag");
            return new DpDict { KeyType = DpWireType.Stop, ValueType = DpWireType.Stop, Count = ReadRawI32() };
        }

        public void ReadMapEnd() { }

        public DpList ReadListBegin()
        {
            if ((PackTag)ReadRawByte() != PackTag.Array) throw new Exception("Expected Array tag");
            return new DpList { ElementType = DpWireType.Stop, Count = ReadRawI32() };
        }

        public void ReadListEnd() { }

        public DpSet ReadSetBegin()
        {
            if ((PackTag)ReadRawByte() != PackTag.Array) throw new Exception("Expected Array tag");
            return new DpSet { ElementType = DpWireType.Stop, Count = ReadRawI32() };
        }

        public void ReadSetEnd() { }

        public bool ReadBool()
        {
            PackTag tag = (PackTag)ReadRawByte();
            return tag == PackTag.True;
        }

        public byte ReadByte() => (byte)ReadI32();
        public short ReadI16() => (short)ReadI32();

        public int ReadI32()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag == PackTag.Int32) return ReadRawI32();
            if (tag == PackTag.Int64) return (int)ReadRawI64();
            throw new Exception("Expected Int tag");
        }

        public long ReadI64()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag == PackTag.Int32) return (long)ReadRawI32();
            if (tag == PackTag.Int64) return ReadRawI64();
            throw new Exception("Expected Int tag");
        }

        public double ReadDouble()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag == PackTag.Double) return BitConverter.Int64BitsToDouble(ReadRawI64());
            if (tag == PackTag.Int32) return (double)ReadRawI32();
            return 0;
        }

        public string? ReadString()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag == PackTag.Null) return null;
            if (tag != PackTag.String) throw new Exception("Expected String tag");
            return ReadRawString();
        }

        public byte[]? ReadBinary()
        {
            PackTag tag = (PackTag)ReadRawByte();
            if (tag == PackTag.Null) return null;
            if (tag != PackTag.Binary) throw new Exception("Expected Binary tag");
            int length = ReadRawI32();
            byte[] bytes = new byte[length];
            ReadAll(bytes);
            return bytes;
        }
    }
}
