/**
 * DeukPack Binary Writer
 * High-performance binary serialization with Arena allocator support
 */

#include "binary_writer.h"
#include <cstring>
#include <algorithm>

namespace deukpack
{
    // Internal arena allocator instance (thread-local would be preferred for MT scenarios)
    static const size_t DEFAULT_ARENA_SIZE = 65536;     // 64KB arena per writer
    static const size_t SMALL_MESSAGE_THRESHOLD = 4096; // Use arena for <4KB allocations

    BinaryWriter::BinaryWriter(Endianness endianness, size_t initialSize)
        : endianness_(endianness), arena_(std::make_shared<ArenaAllocator>(DEFAULT_ARENA_SIZE)), position_(0)
    {
        currentBuffer_.resize(initialSize);
    }

    void BinaryWriter::WriteByte(uint8_t value)
    {
        EnsureCapacity(1);
        currentBuffer_[position_++] = value;
    }

    void BinaryWriter::WriteI16(int16_t value)
    {
        EnsureCapacity(2);

        if (endianness_ == Endianness::Little)
        {
            currentBuffer_[position_] = static_cast<uint8_t>(value & 0xFF);
            currentBuffer_[position_ + 1] = static_cast<uint8_t>((value >> 8) & 0xFF);
        }
        else
        {
            currentBuffer_[position_] = static_cast<uint8_t>((value >> 8) & 0xFF);
            currentBuffer_[position_ + 1] = static_cast<uint8_t>(value & 0xFF);
        }

        position_ += 2;
    }

    void BinaryWriter::WriteI32(int32_t value)
    {
        EnsureCapacity(4);

        if (endianness_ == Endianness::Little)
        {
            currentBuffer_[position_] = static_cast<uint8_t>(value & 0xFF);
            currentBuffer_[position_ + 1] = static_cast<uint8_t>((value >> 8) & 0xFF);
            currentBuffer_[position_ + 2] = static_cast<uint8_t>((value >> 16) & 0xFF);
            currentBuffer_[position_ + 3] = static_cast<uint8_t>((value >> 24) & 0xFF);
        }
        else
        {
            currentBuffer_[position_] = static_cast<uint8_t>((value >> 24) & 0xFF);
            currentBuffer_[position_ + 1] = static_cast<uint8_t>((value >> 16) & 0xFF);
            currentBuffer_[position_ + 2] = static_cast<uint8_t>((value >> 8) & 0xFF);
            currentBuffer_[position_ + 3] = static_cast<uint8_t>(value & 0xFF);
        }

        position_ += 4;
    }

    void BinaryWriter::WriteI64(int64_t value)
    {
        EnsureCapacity(8);

        if (endianness_ == Endianness::Little)
        {
            for (int i = 0; i < 8; i++)
            {
                currentBuffer_[position_ + i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
            }
        }
        else
        {
            for (int i = 0; i < 8; i++)
            {
                currentBuffer_[position_ + i] = static_cast<uint8_t>((value >> ((7 - i) * 8)) & 0xFF);
            }
        }

        position_ += 8;
    }

    void BinaryWriter::WriteDouble(double value)
    {
        EnsureCapacity(8);

        // Convert to IEEE 754 representation
        union
        {
            double d;
            uint8_t bytes[8];
        } converter;

        converter.d = value;

        if (endianness_ == Endianness::Little)
        {
            std::memcpy(&currentBuffer_[position_], converter.bytes, 8);
        }
        else
        {
            // Reverse byte order for big endian
            for (int i = 0; i < 8; i++)
            {
                currentBuffer_[position_ + i] = converter.bytes[7 - i];
            }
        }

        position_ += 8;
    }

    void BinaryWriter::WriteString(const std::string &value)
    {
        WriteI32(static_cast<int32_t>(value.length()));
        WriteBytes(reinterpret_cast<const uint8_t *>(value.c_str()), value.length());
    }

    void BinaryWriter::WriteBytes(const uint8_t *data, size_t length)
    {
        EnsureCapacity(length);
        std::memcpy(&currentBuffer_[position_], data, length);
        position_ += length;
    }

    void BinaryWriter::WriteBinary(const std::vector<uint8_t> &data)
    {
        WriteI32(static_cast<int32_t>(data.size()));
        WriteBytes(data.data(), data.size());
    }

    std::vector<uint8_t> BinaryWriter::GetBuffer()
    {
        FlushCurrentBuffer();

        if (buffers_.empty())
        {
            return std::vector<uint8_t>();
        }

        if (buffers_.size() == 1)
        {
            return std::move(buffers_[0]);
        }

        // Calculate total size
        size_t totalSize = 0;
        for (const auto &buffer : buffers_)
        {
            totalSize += buffer.size();
        }

        // Concatenate all buffers (pre-allocated to avoid secondary allocations)
        std::vector<uint8_t> result;
        result.reserve(totalSize);

        for (const auto &buffer : buffers_)
        {
            result.insert(result.end(), buffer.begin(), buffer.end());
        }

        return result;
    }

    size_t BinaryWriter::GetPosition() const
    {
        size_t totalPosition = 0;
        for (const auto &buffer : buffers_)
        {
            totalPosition += buffer.size();
        }
        return totalPosition + position_;
    }

    void BinaryWriter::Reset()
    {
        buffers_.clear();
        position_ = 0;
        currentBuffer_.resize(1024);

        // Reset arena allocator for next roundtrip
        if (arena_)
        {
            arena_->reset();
        }
    }

    void BinaryWriter::EnsureCapacity(size_t needed)
    {
        if (position_ + needed > currentBuffer_.size())
        {
            FlushCurrentBuffer();
            AllocateNewBuffer(std::max(needed * 2, static_cast<size_t>(1024)));
        }
    }

    void BinaryWriter::FlushCurrentBuffer()
    {
        if (position_ > 0)
        {
            std::vector<uint8_t> buffer(position_);
            std::memcpy(buffer.data(), currentBuffer_.data(), position_);
            buffers_.push_back(std::move(buffer));
            position_ = 0;
        }
    }

    void BinaryWriter::AllocateNewBuffer(size_t size)
    {
        currentBuffer_.resize(size);
        position_ = 0;
    }

} // namespace deukpack
