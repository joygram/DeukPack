/**
 * DeukPack Binary Reader
 * High-performance binary deserialization
 */

#include "binary_reader.h"
#include <algorithm>
#include <cstring>
#include <stdexcept>

namespace deukpack
{

    BinaryReader::BinaryReader(const uint8_t *data, size_t size, Endianness endianness)
        : data_(data), size_(size), position_(0), endianness_(endianness)
    {
    }

    uint8_t BinaryReader::ReadByte()
    {
        if (position_ >= size_)
        {
            throw std::runtime_error("Buffer overflow");
        }
        return data_[position_++];
    }

    int16_t BinaryReader::ReadI16()
    {
        if (position_ + 2 > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        int16_t value;
        if (endianness_ == Endianness::Little)
        {
            value = static_cast<int16_t>(data_[position_] | (data_[position_ + 1] << 8));
        }
        else
        {
            value = static_cast<int16_t>((data_[position_] << 8) | data_[position_ + 1]);
        }

        position_ += 2;
        return value;
    }

    int32_t BinaryReader::ReadI32()
    {
        if (position_ + 4 > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        int32_t value;
        if (endianness_ == Endianness::Little)
        {
            value = data_[position_] |
                    (data_[position_ + 1] << 8) |
                    (data_[position_ + 2] << 16) |
                    (data_[position_ + 3] << 24);
        }
        else
        {
            value = (data_[position_] << 24) |
                    (data_[position_ + 1] << 16) |
                    (data_[position_ + 2] << 8) |
                    data_[position_ + 3];
        }

        position_ += 4;
        return value;
    }

    int64_t BinaryReader::ReadI64()
    {
        if (position_ + 8 > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        int64_t value = 0;
        if (endianness_ == Endianness::Little)
        {
            for (int i = 0; i < 8; i++)
            {
                value |= static_cast<int64_t>(data_[position_ + i]) << (i * 8);
            }
        }
        else
        {
            for (int i = 0; i < 8; i++)
            {
                value |= static_cast<int64_t>(data_[position_ + i]) << ((7 - i) * 8);
            }
        }

        position_ += 8;
        return value;
    }

    double BinaryReader::ReadDouble()
    {
        if (position_ + 8 > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        union
        {
            double d;
            uint8_t bytes[8];
        } converter;

        if (endianness_ == Endianness::Little)
        {
            std::memcpy(converter.bytes, &data_[position_], 8);
        }
        else
        {
            // Reverse byte order for big endian
            for (int i = 0; i < 8; i++)
            {
                converter.bytes[i] = data_[position_ + 7 - i];
            }
        }

        position_ += 8;
        return converter.d;
    }

    std::string BinaryReader::ReadString()
    {
        int32_t rawLen = ReadI32();
        if (rawLen < 0) throw std::runtime_error("Negative string length");
        size_t length = static_cast<size_t>(rawLen);
        if (position_ + length > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        std::string result(reinterpret_cast<const char *>(&data_[position_]), length);
        position_ += length;
        return result;
    }

    std::vector<uint8_t> BinaryReader::ReadBinary()
    {
        int32_t rawLen = ReadI32();
        if (rawLen < 0) throw std::runtime_error("Negative binary length");
        size_t length = static_cast<size_t>(rawLen);
        if (position_ + length > size_)
        {
            throw std::runtime_error("Buffer overflow");
        }

        std::vector<uint8_t> result(data_ + position_, data_ + position_ + length);
        position_ += length;
        return result;
    }

    bool BinaryReader::IsAtEnd() const
    {
        return position_ >= size_;
    }

    size_t BinaryReader::GetPosition() const
    {
        return position_;
    }

    void BinaryReader::SetPosition(size_t position)
    {
        if (position > size_)
        {
            throw std::runtime_error("Position out of bounds");
        }
        position_ = position;
    }

} // namespace deukpack
