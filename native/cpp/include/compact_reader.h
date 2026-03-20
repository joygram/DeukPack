/**
 * DeukPack Compact Reader Header
 * High-performance compact protocol deserialization
 */

#ifndef DEUKPACK_COMPACT_READER_H
#define DEUKPACK_COMPACT_READER_H

#include <cstdint>
#include <string>

namespace deukpack
{

    class CompactReader
    {
    public:
        explicit CompactReader(const uint8_t *data, size_t size);
        ~CompactReader() = default;

        uint8_t ReadByte();
        int32_t ReadVarInt();
        std::string ReadString();

        bool IsAtEnd() const;

    private:
        const uint8_t *data_;
        size_t size_;
        size_t position_;
    };

} // namespace deukpack

#endif // DEUKPACK_COMPACT_READER_H
