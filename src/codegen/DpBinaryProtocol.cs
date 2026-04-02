#nullable enable
using System;
using System.IO;
using System.Text;
using System.Buffers;

namespace DeukPack.Protocol {
    /// <summary>
    /// Binary protocol implementation with FastPacket-level optimization.
    /// Unity compatible high-performance serialization.
    /// </summary>
    public class DpBinaryProtocol : DpProtocol, IDisposable
    {
        private readonly Stream _stream;
        private readonly bool _strictRead;
        private readonly bool _strictWrite;
        private readonly bool _bigEndian;

        // FastPacket-level optimizations
        private static readonly ArrayPool<byte> _bufferPool = ArrayPool<byte>.Shared;
        private byte[]? _writeBuffer;
        private int _writePosition;
        private int _writeCapacity;

        // Read buffer pooling
        private byte[]? _readBuffer;
        private int _readPosition;
        private int _readLength;
        private const int READ_BUFFER_SIZE = 4096;
        private const int MaxBinaryLength = 1024 * 1024 * 10; // 10MB
        private const int MaxElementCount = 1000000; // 1M elements

        // Small buffer for primitive types (stackalloc-like optimization)
        private const int SMALL_BUFFER_SIZE = 16;
        private readonly byte[] _smallBuffer = new byte[SMALL_BUFFER_SIZE];

        private readonly bool _directWrite;
#pragma warning disable CS0414 // assigned but never used (reserved for potential stream disposal)
        private readonly bool _ownsStream;
#pragma warning restore CS0414

        /// <summary>
        /// 기본 생성자: 내부 MemoryStream 자동 생성 (Write 후 ToBytes()로 결과 획득)
        /// </summary>
        public DpBinaryProtocol() : this(new MemoryStream())
        {
            _ownsStream = true;
        }

        /// <summary>
        /// byte[] 로부터 Read용 프로토콜 생성
        /// </summary>
        public DpBinaryProtocol(byte[] data) : this(new MemoryStream(data))
        {
            _ownsStream = true;
        }

        /// <param name="bigEndian">true = Binary(Apache 호환), false = LEBinary</param>
        public DpBinaryProtocol(Stream stream, bool bigEndian = true, bool strictRead = true, bool strictWrite = true, int initialBufferSize = 4096)
        {
            _stream = stream;
            _bigEndian = bigEndian;
            _strictRead = strictRead;
            _strictWrite = strictWrite;
            _ownsStream = false;

            _directWrite = (stream is System.IO.MemoryStream);

            if (!_directWrite && initialBufferSize > 0)
            {
                _writeBuffer = _bufferPool.Rent(initialBufferSize);
                _writeCapacity = _writeBuffer.Length;
            }
            _writePosition = 0;

            _readBuffer = _bufferPool.Rent(READ_BUFFER_SIZE);
            _readPosition = 0;
            _readLength = 0;
        }

        /// <summary>
        /// Write한 결과를 byte[]로 반환 (내부 MemoryStream 사용 시)
        /// </summary>
        public byte[] ToBytes()
        {
            if (_stream is MemoryStream ms)
                return ms.ToArray();
            throw new InvalidOperationException("ToBytes() is only available when using internal MemoryStream.");
        }

        private void EnsureWriteBuffer(int additionalBytes)
        {
            if (_directWrite) return;
            if (_writeBuffer == null || _writePosition + additionalBytes > _writeCapacity)
            {
                FlushWriteBuffer();
                int newSize = Math.Max(_writePosition + additionalBytes, _writeCapacity * 2);
                if (_writeBuffer != null)
                {
                    _bufferPool.Return(_writeBuffer);
                }
                _writeBuffer = _bufferPool.Rent(newSize);
                _writeCapacity = _writeBuffer.Length;
            }
        }

        private void FlushWriteBuffer()
        {
            if (_writeBuffer != null && _writePosition > 0)
            {
                _stream.Write(_writeBuffer, 0, _writePosition);
                _writePosition = 0;
            }
        }

        public void Dispose()
        {
            FlushWriteBuffer();
            if (_writeBuffer != null)
            {
                _bufferPool.Return(_writeBuffer);
                _writeBuffer = null;
            }
            if (_readBuffer != null)
            {
                _bufferPool.Return(_readBuffer);
                _readBuffer = null;
            }
        }

        public void WriteStructBegin(DpRecord structBegin)
        {
            // Binary protocol doesn't write struct names
        }

        public void WriteStructEnd()
        {
            // Binary protocol doesn't write struct end markers
        }

        /// <summary>
        /// Flush all buffered writes to stream.
        /// No-op when stream is MemoryStream (direct write mode).
        /// </summary>
        public void Flush()
        {
            if (!_directWrite) FlushWriteBuffer();
        }

        public void WriteFieldBegin(DpColumn field)
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
            WriteByte((byte)DpWireType.Stop);
        }

        public void WriteBool(bool b)
        {
            WriteByte(b ? (byte)1 : (byte)0);
        }

        public void WriteByte(byte b)
        {
            if (_directWrite) { _stream.WriteByte(b); return; }
            EnsureWriteBuffer(1);
            _writeBuffer![_writePosition++] = b;
        }

        public void WriteI16(short i16)
        {
            if (_directWrite)
            {
                if (_bigEndian)
                {
                    _smallBuffer[0] = (byte)((i16 >> 8) & 0xFF);
                    _smallBuffer[1] = (byte)(i16 & 0xFF);
                }
                else
                {
                    _smallBuffer[0] = (byte)(i16 & 0xFF);
                    _smallBuffer[1] = (byte)((i16 >> 8) & 0xFF);
                }
                _stream.Write(_smallBuffer, 0, 2);
                return;
            }
            EnsureWriteBuffer(2);
            WriteI16Optimized(i16);
        }

        public void WriteI32(int i32)
        {
            if (_directWrite)
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
                return;
            }
            EnsureWriteBuffer(4);
            WriteI32Optimized(i32);
        }

        public void WriteI64(long i64)
        {
            if (_directWrite)
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
                return;
            }
            EnsureWriteBuffer(8);
            WriteI64Optimized(i64);
        }

        public void WriteDouble(double d)
        {
            if (_directWrite)
            {
                WriteI64(BitConverter.DoubleToInt64Bits(d));
                return;
            }
            EnsureWriteBuffer(8);
            WriteDoubleOptimized(d);
        }

        public void WriteString(string? s)
        {
            if (s == null)
            {
                WriteI32(0);
                return;
            }

            int byteCount = Encoding.UTF8.GetByteCount(s);
            WriteI32(byteCount);

            if (byteCount > 0)
            {
                if (_directWrite)
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(s);
                    _stream.Write(bytes, 0, bytes.Length);
                }
                else
                {
                    EnsureWriteBuffer(byteCount);
                    Encoding.UTF8.GetBytes(s, 0, s.Length, _writeBuffer!, _writePosition);
                    _writePosition += byteCount;
                }
            }
        }

        public void WriteBinary(byte[]? b)
        {
            if (b == null)
            {
                WriteI32(0);
                return;
            }

            WriteI32(b.Length);
            if (b.Length > 0)
            {
                if (_directWrite)
                {
                    _stream.Write(b, 0, b.Length);
                }
                else
                {
                    EnsureWriteBuffer(b.Length);
                    Array.Copy(b, 0, _writeBuffer!, _writePosition, b.Length);
                    _writePosition += b.Length;
                }
            }
        }

        private void WriteI16Optimized(short value)
        {
            var wb = _writeBuffer!;
            if (_bigEndian)
            {
                wb[_writePosition] = (byte)((value >> 8) & 0xFF);
                wb[_writePosition + 1] = (byte)(value & 0xFF);
            }
            else
            {
                wb[_writePosition] = (byte)(value & 0xFF);
                wb[_writePosition + 1] = (byte)((value >> 8) & 0xFF);
            }
            _writePosition += 2;
        }

        private void WriteI32Optimized(int value)
        {
            var wb = _writeBuffer!;
            if (_bigEndian)
            {
                wb[_writePosition] = (byte)((value >> 24) & 0xFF);
                wb[_writePosition + 1] = (byte)((value >> 16) & 0xFF);
                wb[_writePosition + 2] = (byte)((value >> 8) & 0xFF);
                wb[_writePosition + 3] = (byte)(value & 0xFF);
            }
            else
            {
                wb[_writePosition] = (byte)(value & 0xFF);
                wb[_writePosition + 1] = (byte)((value >> 8) & 0xFF);
                wb[_writePosition + 2] = (byte)((value >> 16) & 0xFF);
                wb[_writePosition + 3] = (byte)((value >> 24) & 0xFF);
            }
            _writePosition += 4;
        }

        private void WriteI64Optimized(long value)
        {
            var wb = _writeBuffer!;
            if (_bigEndian)
            {
                wb[_writePosition] = (byte)((value >> 56) & 0xFF);
                wb[_writePosition + 1] = (byte)((value >> 48) & 0xFF);
                wb[_writePosition + 2] = (byte)((value >> 40) & 0xFF);
                wb[_writePosition + 3] = (byte)((value >> 32) & 0xFF);
                wb[_writePosition + 4] = (byte)((value >> 24) & 0xFF);
                wb[_writePosition + 5] = (byte)((value >> 16) & 0xFF);
                wb[_writePosition + 6] = (byte)((value >> 8) & 0xFF);
                wb[_writePosition + 7] = (byte)(value & 0xFF);
            }
            else
            {
                wb[_writePosition] = (byte)(value & 0xFF);
                wb[_writePosition + 1] = (byte)((value >> 8) & 0xFF);
                wb[_writePosition + 2] = (byte)((value >> 16) & 0xFF);
                wb[_writePosition + 3] = (byte)((value >> 24) & 0xFF);
                wb[_writePosition + 4] = (byte)((value >> 32) & 0xFF);
                wb[_writePosition + 5] = (byte)((value >> 40) & 0xFF);
                wb[_writePosition + 6] = (byte)((value >> 48) & 0xFF);
                wb[_writePosition + 7] = (byte)((value >> 56) & 0xFF);
            }
            _writePosition += 8;
        }

        private void WriteDoubleOptimized(double value)
        {
            // Convert double to long and write as I64
            long bits = BitConverter.DoubleToInt64Bits(value);
            WriteI64Optimized(bits);
        }

        public void WriteListBegin(DpList list)
        {
            WriteByte((byte)list.ElementType);
            WriteI32(list.Count);
        }

        public void WriteListEnd()
        {
            // Binary protocol doesn't write list end markers
        }

        public void WriteSetBegin(DpSet set)
        {
            WriteByte((byte)set.ElementType);
            WriteI32(set.Count);
        }

        public void WriteSetEnd()
        {
            // Binary protocol doesn't write set end markers
        }

        public void WriteMapBegin(DpDict map)
        {
            WriteByte((byte)map.KeyType);
            WriteByte((byte)map.ValueType);
            WriteI32(map.Count);
        }

        public void WriteMapEnd()
        {
            // Binary protocol doesn't write map end markers
        }

        public DpRecord ReadStructBegin()
        {
            return new DpRecord();
        }

        public void ReadStructEnd()
        {
            // Binary protocol doesn't read struct end markers
        }

        public DpColumn ReadFieldBegin()
        {
            byte type = ReadByte();
            if (type == (byte)DpWireType.Stop)
            {
                return new DpColumn("", DpWireType.Stop, 0);
            }
            short id = ReadI16();
            return new DpColumn("", (DpWireType)type, id);
        }

        public void ReadFieldEnd()
        {
            // Binary protocol doesn't read field end markers
        }

        public bool ReadBool()
        {
            return ReadByte() != 0;
        }

        private void EnsureReadBuffer(int bytesNeeded)
        {
            if (_readPosition + bytesNeeded <= _readLength)
                return;

            int remaining = _readLength - _readPosition;
            var readBuf = _readBuffer ?? throw new ObjectDisposedException(nameof(DpBinaryProtocol));

            if (bytesNeeded > readBuf.Length)
            {
                var newBuf = _bufferPool.Rent(bytesNeeded + READ_BUFFER_SIZE);
                if (remaining > 0)
                    Array.Copy(readBuf, _readPosition, newBuf, 0, remaining);
                _bufferPool.Return(readBuf);
                _readBuffer = newBuf;
                readBuf = newBuf;
            }
            else if (remaining > 0)
            {
                Array.Copy(readBuf, _readPosition, readBuf, 0, remaining);
            }
            _readPosition = 0;
            _readLength = remaining;

            while (_readLength < bytesNeeded)
            {
                int bytesRead = _stream.Read(readBuf, _readLength, readBuf.Length - _readLength);
                if (bytesRead == 0)
                    throw new EndOfStreamException();
                _readLength += bytesRead;
            }
        }

        public byte ReadByte()
        {
            EnsureReadBuffer(1);
            return _readBuffer![_readPosition++];
        }

        public short ReadI16()
        {
            EnsureReadBuffer(2);
            return ReadI16Optimized();
        }

        public int ReadI32()
        {
            EnsureReadBuffer(4);
            return ReadI32Optimized();
        }

        public long ReadI64()
        {
            EnsureReadBuffer(8);
            return ReadI64Optimized();
        }

        public double ReadDouble()
        {
            // Convert from long bits
            long bits = ReadI64();
            return BitConverter.Int64BitsToDouble(bits);
        }

        public string? ReadString()
        {
            int length = ReadI32();
            if (length == 0)
                return string.Empty;
            if (length < 0 || length > MaxBinaryLength)
                throw new InvalidOperationException($"Invalid string length: {length}");

            EnsureReadBuffer(length);
            string result = Encoding.UTF8.GetString(_readBuffer!, _readPosition, length);
            _readPosition += length;
            return result;
        }

        public byte[]? ReadBinary()
        {
            int length = ReadI32();
            if (length == 0)
                return new byte[0];
            if (length < 0 || length > MaxBinaryLength)
                throw new InvalidOperationException($"Invalid binary length: {length}");

            EnsureReadBuffer(length);
            byte[] result = new byte[length];
            Array.Copy(_readBuffer!, _readPosition, result, 0, length);
            _readPosition += length;
            return result;
        }

        // 엔디언: _bigEndian에 따라 BE / LE(네트워크 바이트 순서) 고정
        private short ReadI16Optimized()
        {
            var rb = _readBuffer!;
            short value = _bigEndian
                ? (short)((rb[_readPosition] << 8) | rb[_readPosition + 1])
                : (short)(rb[_readPosition] | (rb[_readPosition + 1] << 8));
            _readPosition += 2;
            return value;
        }

        private int ReadI32Optimized()
        {
            var rb = _readBuffer!;
            int b0 = rb[_readPosition], b1 = rb[_readPosition + 1], b2 = rb[_readPosition + 2], b3 = rb[_readPosition + 3];
            _readPosition += 4;
            return _bigEndian
                ? (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
                : (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
        }

        private long ReadI64Optimized()
        {
            var rb = _readBuffer!;
            long b0 = rb[_readPosition], b1 = rb[_readPosition + 1], b2 = rb[_readPosition + 2], b3 = rb[_readPosition + 3],
                 b4 = rb[_readPosition + 4], b5 = rb[_readPosition + 5], b6 = rb[_readPosition + 6], b7 = rb[_readPosition + 7];
            _readPosition += 8;
            return _bigEndian
                ? ((long)b0 << 56) | ((long)b1 << 48) | ((long)b2 << 40) | ((long)b3 << 32) | ((long)b4 << 24) | ((long)b5 << 16) | ((long)b6 << 8) | b7
                : ((long)b7 << 56) | ((long)b6 << 48) | ((long)b5 << 40) | ((long)b4 << 32) | ((long)b3 << 24) | ((long)b2 << 16) | ((long)b1 << 8) | b0;
        }

        public DpList ReadListBegin()
        {
            byte elementType = ReadByte();
            int count = ReadI32();
            if (count < 0 || count > MaxElementCount) throw new InvalidOperationException($"Invalid list count: {count}");
            return new DpList { ElementType = (DpWireType)elementType, Count = count };
        }

        public void ReadListEnd()
        {
            // Binary protocol doesn't read list end markers
        }

        public DpSet ReadSetBegin()
        {
            byte elementType = ReadByte();
            int count = ReadI32();
            if (count < 0 || count > MaxElementCount) throw new InvalidOperationException($"Invalid set count: {count}");
            return new DpSet { ElementType = (DpWireType)elementType, Count = count };
        }

        public void ReadSetEnd()
        {
            // Binary protocol doesn't read set end markers
        }

        public DpDict ReadMapBegin()
        {
            byte keyType = ReadByte();
            byte valueType = ReadByte();
            int count = ReadI32();
            if (count < 0 || count > MaxElementCount) throw new InvalidOperationException($"Invalid map count: {count}");
            return new DpDict { KeyType = (DpWireType)keyType, ValueType = (DpWireType)valueType, Count = count };
        }

        public void ReadMapEnd()
        {
            // Binary protocol doesn't read map end markers
        }
    }
}
