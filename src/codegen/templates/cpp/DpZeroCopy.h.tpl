#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <cstring>
#include "DpProtocol.h" // For DpWireType

// V2.0 Zero-Copy Array Writer (No Virtual, No Stream)
class ZeroCopyWriter {
    uint8_t* cursor_;
public:
    ZeroCopyWriter(uint8_t* buffer) : cursor_(buffer) {}

    // Inline exact writers
    inline void WriteByte(uint8_t value) {
        *cursor_++ = value;
    }

    inline void WriteI16(int16_t value) {
        *cursor_++ = static_cast<uint8_t>((value >> 8) & 0xFF);
        *cursor_++ = static_cast<uint8_t>(value & 0xFF);
    }

    inline void WriteI32(int32_t value) {
        *cursor_++ = static_cast<uint8_t>((value >> 24) & 0xFF);
        *cursor_++ = static_cast<uint8_t>((value >> 16) & 0xFF);
        *cursor_++ = static_cast<uint8_t>((value >> 8) & 0xFF);
        *cursor_++ = static_cast<uint8_t>(value & 0xFF);
    }

    inline void WriteI64(int64_t value) {
        for (int i = 7; i >= 0; --i) {
            *cursor_++ = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
        }
    }

    inline void WriteDouble(double value) {
        union { double d; int64_t i; } u;
        u.d = value;
        WriteI64(u.i);
    }

    inline void WriteString(const std::string& value) {
        WriteI32(static_cast<int32_t>(value.length()));
        if (!value.empty()) {
            std::memcpy(cursor_, value.data(), value.length());
            cursor_ += value.length();
        }
    }

    // DeukPack Format Helpers
    inline void WriteFieldBegin(uint8_t type, int16_t id) {
        WriteByte(type);
        WriteI16(id);
    }

    inline void WriteFieldStop() {
        WriteByte(static_cast<uint8_t>(deuk::DpWireType::Stop));
    }

    inline void WriteListBegin(uint8_t elem_type, int32_t count) {
        WriteByte(elem_type);
        WriteI32(count);
    }

    inline void WriteSetBegin(uint8_t elem_type, int32_t count) {
        WriteListBegin(elem_type, count);
    }

    inline void WriteMapBegin(uint8_t key_type, uint8_t val_type, int32_t count) {
        WriteByte(key_type);
        WriteByte(val_type);
        WriteI32(count);
    }

    uint8_t* GetCursor() const { return cursor_; }
};

// V2.0 Zero-Copy Array Reader (No Virtual, No Stream, Only Pointer Ops)
class ZeroCopyReader {
    const uint8_t* cursor_;
    const uint8_t* end_;
public:
    ZeroCopyReader(const uint8_t* buffer, size_t size) : cursor_(buffer), end_(buffer + size) {}

    inline uint8_t ReadByte() {
        return (cursor_ < end_) ? *cursor_++ : 0;
    }

    inline int16_t ReadI16() {
        if (cursor_ + 2 > end_) return 0;
        int16_t res = (static_cast<int16_t>(cursor_[0]) << 8) | static_cast<int16_t>(cursor_[1]);
        cursor_ += 2;
        return res;
    }

    inline int32_t ReadI32() {
        if (cursor_ + 4 > end_) return 0;
        int32_t res = (static_cast<int32_t>(cursor_[0]) << 24) |
                      (static_cast<int32_t>(cursor_[1]) << 16) |
                      (static_cast<int32_t>(cursor_[2]) << 8) |
                      static_cast<int32_t>(cursor_[3]);
        cursor_ += 4;
        return res;
    }

    inline int64_t ReadI64() {
        if (cursor_ + 8 > end_) return 0;
        int64_t res = 0;
        for (int i = 7; i >= 0; --i) {
            res |= (static_cast<int64_t>(*cursor_++) << (i * 8));
        }
        return res;
    }

    inline double ReadDouble() {
        union { int64_t i; double d; } u;
        u.i = ReadI64();
        return u.d;
    }

    inline std::string ReadString() {
        int32_t len = ReadI32();
        if (len <= 0 || cursor_ + len > end_) return "";
        std::string res(reinterpret_cast<const char*>(cursor_), len);
        cursor_ += len;
        return res;
    }

    inline bool ReadFieldBegin(uint8_t& type, int16_t& id) {
        type = ReadByte();
        if (type == static_cast<uint8_t>(deuk::DpWireType::Stop)) return false;
        id = ReadI16();
        return true;
    }

    inline void ReadListBegin(uint8_t& elem_type, int32_t& count) {
        elem_type = ReadByte();
        count = ReadI32();
    }

    inline void ReadSetBegin(uint8_t& elem_type, int32_t& count) {
        ReadListBegin(elem_type, count);
    }

    inline void ReadMapBegin(uint8_t& key_type, uint8_t& val_type, int32_t& count) {
        key_type = ReadByte();
        val_type = ReadByte();
        count = ReadI32();
    }

    inline void Skip(uint8_t wire_type) {
        if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Bool) || wire_type == static_cast<uint8_t>(deuk::DpWireType::Byte)) cursor_ += 1;
        else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Int16)) cursor_ += 2;
        else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Int32)) cursor_ += 4;
        else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Int64) || wire_type == static_cast<uint8_t>(deuk::DpWireType::Double)) cursor_ += 8;
        else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::String)) cursor_ += ReadI32();
        else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::List) || wire_type == static_cast<uint8_t>(deuk::DpWireType::Set)) {
            uint8_t et; int32_t c; ReadListBegin(et, c);
            for(int32_t i=0; i<c; ++i) Skip(et);
        } else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Map)) {
            uint8_t kt; uint8_t vt; int32_t c; ReadMapBegin(kt, vt, c);
            for(int32_t i=0; i<c; ++i) { Skip(kt); Skip(vt); }
        } else if (wire_type == static_cast<uint8_t>(deuk::DpWireType::Struct)) {
            while (true) {
                uint8_t t; int16_t id;
                if (!ReadFieldBegin(t, id)) break;
                Skip(t);
            }
        }
    }
};
