/**
 * DeukPack Binary Writer Header
 * High-performance binary serialization with optional Arena allocator
 * Guard: DEUKPACK_ prefix to avoid clashes.
 */

#ifndef DEUKPACK_BINARY_WRITER_H
#define DEUKPACK_BINARY_WRITER_H

#include <vector>
#include <cstdint>
#include <string>
#include <memory>
#include "wire_engine.h"
#include "memory_pool.h"

namespace deukpack
{

    class BinaryWriter
    {
    public:
        explicit BinaryWriter(Endianness endianness = Endianness::Little, size_t initialSize = 1024);
        ~BinaryWriter() = default;

        // Set arena allocator for zero-alloc optimization (optional)
        void SetArenaAllocator(std::shared_ptr<ArenaAllocator> arena) { arena_ = arena; }

        // Basic types
        void WriteByte(uint8_t value);
        void WriteI16(int16_t value);
        void WriteI32(int32_t value);
        void WriteI64(int64_t value);
        void WriteDouble(double value);

        // String and binary
        void WriteString(const std::string &value);
        void WriteBytes(const uint8_t *data, size_t length);
        void WriteBinary(const std::vector<uint8_t> &data);

        // Buffer management
        std::vector<uint8_t> GetBuffer();
        size_t GetPosition() const;
        void Reset();

    private:
        void EnsureCapacity(size_t needed);
        void FlushCurrentBuffer();
        void AllocateNewBuffer(size_t size);

        Endianness endianness_;
        std::vector<uint8_t> currentBuffer_;
        std::vector<std::vector<uint8_t>> buffers_;
        std::shared_ptr<ArenaAllocator> arena_; // Optional arena allocator for zero-alloc path
        size_t position_;
    };

} // namespace deukpack

#endif // DEUKPACK_BINARY_WRITER_H
