/**
 * DeukPack Compact Reader
 * High-performance compact protocol deserialization
 */

#include "compact_reader.h"
#include <stdexcept>

namespace deukpack
{

    CompactReader::CompactReader(const uint8_t *data, size_t size)
        : data_(data), size_(size), position_(0)
    {
    }

    uint8_t CompactReader::ReadByte()
    {
        if (position_ >= size_)
        {
            throw std::runtime_error("Buffer overflow");
        }
        return data_[position_++];
    }

    int32_t CompactReader::ReadVarInt()
    {
        int32_t result = 0;
        int shift = 0;

        while (position_ < size_)
        {
            uint8_t byte = data_[position_++];
            result |= (byte & 0x7F) << shift;

            if ((byte & 0x80) == 0)
            {
                break;
            }

            shift += 7;
            if (shift >= 32)
            {
                throw std::runtime_error("VarInt too large");
            }
        }

        return result;
    }

    std::string CompactReader::ReadString()
    {
        int32_t length = ReadVarInt();
        if (position_ + length > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        std::string result(reinterpret_cast<const char *>(&data_[position_]), length);
        position_ += length;
        return result;
    }

    bool CompactReader::IsAtEnd() const
    {
        return position_ >= size_;
    }

} // namespace deukpack
