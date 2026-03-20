/**
 * DeukPack Binary Reader Header
 * High-performance binary deserialization
 * Guard: DEUKPACK_ prefix to avoid clashes.
 */

#ifndef DEUKPACK_BINARY_READER_H
#define DEUKPACK_BINARY_READER_H

#include <vector>
#include <cstdint>
#include <string>
#include "wire_engine.h"

namespace deukpack
{

    class BinaryReader
    {
    public:
        explicit BinaryReader(const uint8_t *data, size_t size, Endianness endianness = Endianness::Little);
        ~BinaryReader() = default;

        // Basic types
        uint8_t ReadByte();
        int16_t ReadI16();
        int32_t ReadI32();
        int64_t ReadI64();
        double ReadDouble();

        // String and binary
        std::string ReadString();
        std::vector<uint8_t> ReadBinary();

        // Buffer management
        bool IsAtEnd() const;
        size_t GetPosition() const;
        void SetPosition(size_t position);

    private:
        const uint8_t *data_;
        size_t size_;
        size_t position_;
        Endianness endianness_;
    };

} // namespace deukpack

#endif // DEUKPACK_BINARY_READER_H
