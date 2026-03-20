/**
 * DeukPack Compact Writer Header
 * High-performance compact protocol serialization
 */

#ifndef DEUKPACK_COMPACT_WRITER_H
#define DEUKPACK_COMPACT_WRITER_H

#include <vector>
#include <cstdint>
#include <string>
#include <cstring>

namespace deukpack
{

    class CompactWriter
    {
    public:
        explicit CompactWriter(size_t initialSize = 1024);
        ~CompactWriter() = default;

        void WriteByte(uint8_t value);
        void WriteVarInt(int32_t value);
        void WriteString(const std::string &value);
        void WriteBytes(const uint8_t *data, size_t length);

        std::vector<uint8_t> GetBuffer();
        void Reset();

    private:
        void EnsureCapacity(size_t needed);
        void FlushCurrentBuffer();
        void AllocateNewBuffer(size_t size);

        std::vector<uint8_t> currentBuffer_;
        std::vector<std::vector<uint8_t>> buffers_;
        size_t position_;
    };

} // namespace deukpack

#endif // DEUKPACK_COMPACT_WRITER_H
