/**
 * Thrift 호환 전용 별도 구현. Apache Thrift TBinaryProtocol과 동일한 API·와이어 포맷.
 * DpProtocolLibrary 모듈화.
 */

using System;
using System.IO;
using System.Text;

namespace DeukPack.Protocol
{
    /// <summary>
    /// Thrift 호환 전용 별도 구현. Apache Thrift TBinaryProtocol과 동일한 API·와이어 포맷 제공.
    /// DpBinaryProtocol과 독립된 코드 경로로, Protobuf 계열 최적화 없이 Thrift 동작만 보장.
    /// </summary>
    public sealed class TBinaryProtocol : DpProtocol, IDisposable
    {
        private readonly Stream _stream;
        private readonly bool _bigEndian;
        private const int ReadBufferSize = 4096;
        private const int MaxBinaryLength = 1024 * 1024 * 10; // 10MB
        private byte[] _readBuffer;
        private int _readPosition;
        private int _readLength;
        private readonly byte[] _smallBuffer = new byte[8];

        public TBinaryProtocol(Stream stream, bool bigEndian = true, bool strictRead = true, bool strictWrite = true)
        {
            _stream = stream ?? throw new ArgumentNullException(nameof(stream));
            _bigEndian = bigEndian;
            _readBuffer = new byte[ReadBufferSize];
        }

        public void Dispose() { }

        public void Flush() => _stream?.Flush();

        public void WriteStructBegin(DpRecord structBegin) { }
        public void WriteStructEnd() { }
        public void WriteFieldBegin(DpColumn field) { WriteByte((byte)field.Type); WriteI16(field.ID); }
        public void WriteFieldEnd() { }
        public void WriteFieldStop() { WriteByte((byte)DpWireType.Stop); }
        public void WriteBool(bool b) { WriteByte(b ? (byte)1 : (byte)0); }
        public void WriteByte(byte b) { _stream.WriteByte(b); }

        public void WriteI16(short i16)
        {
            if (_bigEndian) { _smallBuffer[0] = (byte)((i16 >> 8) & 0xFF); _smallBuffer[1] = (byte)(i16 & 0xFF); }
            else { _smallBuffer[0] = (byte)(i16 & 0xFF); _smallBuffer[1] = (byte)((i16 >> 8) & 0xFF); }
            _stream.Write(_smallBuffer, 0, 2);
        }

        public void WriteI32(int i32)
        {
            if (_bigEndian)
            {
                _smallBuffer[0] = (byte)((i32 >> 24) & 0xFF);
                _smallBuffer[1] = (byte)((i32 >> 16) & 0xFF);
                _smallBuffer[2] = (byte)((i32 >> 8) & 0xFF);
                _smallBuffer[3] = (byte)(i32 & 0xFF);
            }
            else
            {
                _smallBuffer[0] = (byte)(i32 & 0xFF);
                _smallBuffer[1] = (byte)((i32 >> 8) & 0xFF);
                _smallBuffer[2] = (byte)((i32 >> 16) & 0xFF);
                _smallBuffer[3] = (byte)((i32 >> 24) & 0xFF);
            }
            _stream.Write(_smallBuffer, 0, 4);
        }

        public void WriteI64(long i64)
        {
            if (_bigEndian)
            {
                _smallBuffer[0] = (byte)((i64 >> 56) & 0xFF);
                _smallBuffer[1] = (byte)((i64 >> 48) & 0xFF);
                _smallBuffer[2] = (byte)((i64 >> 40) & 0xFF);
                _smallBuffer[3] = (byte)((i64 >> 32) & 0xFF);
                _smallBuffer[4] = (byte)((i64 >> 24) & 0xFF);
                _smallBuffer[5] = (byte)((i64 >> 16) & 0xFF);
                _smallBuffer[6] = (byte)((i64 >> 8) & 0xFF);
                _smallBuffer[7] = (byte)(i64 & 0xFF);
            }
            else
            {
                _smallBuffer[0] = (byte)(i64 & 0xFF);
                _smallBuffer[1] = (byte)((i64 >> 8) & 0xFF);
                _smallBuffer[2] = (byte)((i64 >> 16) & 0xFF);
                _smallBuffer[3] = (byte)((i64 >> 24) & 0xFF);
                _smallBuffer[4] = (byte)((i64 >> 32) & 0xFF);
                _smallBuffer[5] = (byte)((i64 >> 40) & 0xFF);
                _smallBuffer[6] = (byte)((i64 >> 48) & 0xFF);
                _smallBuffer[7] = (byte)((i64 >> 56) & 0xFF);
            }
            _stream.Write(_smallBuffer, 0, 8);
        }

        public void WriteDouble(double d) { WriteI64(BitConverter.DoubleToInt64Bits(d)); }

        public void WriteString(string s)
        {
            if (s == null) { WriteI32(0); return; }
            byte[] bytes = Encoding.UTF8.GetBytes(s);
            WriteI32(bytes.Length);
            if (bytes.Length > 0) _stream.Write(bytes, 0, bytes.Length);
        }

        public void WriteBinary(byte[] b)
        {
            if (b == null) { WriteI32(0); return; }
            WriteI32(b.Length);
            if (b.Length > 0) _stream.Write(b, 0, b.Length);
        }

        public void WriteListBegin(DpList list) { WriteByte((byte)list.ElementType); WriteI32(list.Count); }
        public void WriteListEnd() { }
        public void WriteSetBegin(DpSet set) { WriteByte((byte)set.ElementType); WriteI32(set.Count); }
        public void WriteSetEnd() { }
        public void WriteMapBegin(DpDict map) { WriteByte((byte)map.KeyType); WriteByte((byte)map.ValueType); WriteI32(map.Count); }
        public void WriteMapEnd() { }

        public DpRecord ReadStructBegin() { return new DpRecord(); }
        public void ReadStructEnd() { }

        public DpColumn ReadFieldBegin()
        {
            byte type = ReadByte();
            if (type == (byte)DpWireType.Stop) return new DpColumn("", DpWireType.Stop, 0);
            short id = ReadI16();
            return new DpColumn("", (DpWireType)type, id);
        }

        public void ReadFieldEnd() { }
        public bool ReadBool() { return ReadByte() != 0; }

        private void EnsureReadBuffer(int bytesNeeded)
        {
            if (_readPosition + bytesNeeded <= _readLength) return;
            int remaining = _readLength - _readPosition;
            if (bytesNeeded > _readBuffer.Length)
            {
                byte[] newBuf = new byte[bytesNeeded + ReadBufferSize];
                if (remaining > 0) Array.Copy(_readBuffer, _readPosition, newBuf, 0, remaining);
                _readBuffer = newBuf;
                _readPosition = 0;
                _readLength = remaining;
            }
            else if (remaining > 0)
            {
                Array.Copy(_readBuffer, _readPosition, _readBuffer, 0, remaining);
                _readPosition = 0;
                _readLength = remaining;
            }
            else { _readPosition = 0; _readLength = 0; }
            while (_readLength < bytesNeeded)
            {
                int n = _stream.Read(_readBuffer, _readLength, _readBuffer.Length - _readLength);
                if (n == 0) throw new EndOfStreamException();
                _readLength += n;
            }
        }

        public byte ReadByte() { EnsureReadBuffer(1); return _readBuffer[_readPosition++]; }

        public short ReadI16()
        {
            EnsureReadBuffer(2);
            short v = _bigEndian
                ? (short)((_readBuffer[_readPosition] << 8) | _readBuffer[_readPosition + 1])
                : (short)(_readBuffer[_readPosition] | (_readBuffer[_readPosition + 1] << 8));
            _readPosition += 2;
            return v;
        }

        public int ReadI32()
        {
            EnsureReadBuffer(4);
            int b0 = _readBuffer[_readPosition], b1 = _readBuffer[_readPosition + 1], b2 = _readBuffer[_readPosition + 2], b3 = _readBuffer[_readPosition + 3];
            _readPosition += 4;
            return _bigEndian ? (b0 << 24) | (b1 << 16) | (b2 << 8) | b3 : (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
        }

        public long ReadI64()
        {
            EnsureReadBuffer(8);
            long b0 = _readBuffer[_readPosition], b1 = _readBuffer[_readPosition + 1], b2 = _readBuffer[_readPosition + 2], b3 = _readBuffer[_readPosition + 3],
                 b4 = _readBuffer[_readPosition + 4], b5 = _readBuffer[_readPosition + 5], b6 = _readBuffer[_readPosition + 6], b7 = _readBuffer[_readPosition + 7];
            _readPosition += 8;
            return _bigEndian
                ? ((long)b0 << 56) | ((long)b1 << 48) | ((long)b2 << 40) | ((long)b3 << 32) | ((long)b4 << 24) | ((long)b5 << 16) | ((long)b6 << 8) | b7
                : ((long)b7 << 56) | ((long)b6 << 48) | ((long)b5 << 40) | ((long)b4 << 32) | ((long)b3 << 24) | ((long)b2 << 16) | ((long)b1 << 8) | b0;
        }

        public double ReadDouble() { return BitConverter.Int64BitsToDouble(ReadI64()); }

        public string ReadString()
        {
            int length = ReadI32();
            if (length == 0) return string.Empty;
            if (length < 0 || length > MaxBinaryLength) throw new InvalidOperationException($"Invalid string length: {length}");
            EnsureReadBuffer(length);
            string result = Encoding.UTF8.GetString(_readBuffer, _readPosition, length);
            _readPosition += length;
            return result;
        }

        public byte[] ReadBinary()
        {
            int length = ReadI32();
            if (length == 0) return Array.Empty<byte>();
            if (length < 0 || length > MaxBinaryLength) throw new InvalidOperationException($"Invalid binary length: {length}");
            EnsureReadBuffer(length);
            byte[] result = new byte[length];
            Array.Copy(_readBuffer, _readPosition, result, 0, length);
            _readPosition += length;
            return result;
        }

        public DpList ReadListBegin() { byte elementType = ReadByte(); int count = ReadI32(); return new DpList { ElementType = (DpWireType)elementType, Count = count }; }
        public void ReadListEnd() { }
        public DpSet ReadSetBegin() { byte elementType = ReadByte(); int count = ReadI32(); return new DpSet { ElementType = (DpWireType)elementType, Count = count }; }
        public void ReadSetEnd() { }
        public DpDict ReadMapBegin() { byte keyType = ReadByte(); byte valueType = ReadByte(); int count = ReadI32(); return new DpDict { KeyType = (DpWireType)keyType, ValueType = (DpWireType)valueType, Count = count }; }
        public void ReadMapEnd() { }
    }
}
