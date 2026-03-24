/**
 * DeukPack Compact Writer
 * High-performance compact protocol serialization
 */

#include "compact_writer.h"
#include <algorithm>
#include <cstring>

namespace deukpack
{

    CompactWriter::CompactWriter(size_t initialSize)
        : position_(0)
    {
        currentBuffer_.resize(initialSize);
    }

    void CompactWriter::WriteByte(uint8_t value)
    {
        EnsureCapacity(1);
        currentBuffer_[position_++] = value;
    }

    void CompactWriter::WriteVarInt(int32_t value)
    {
        auto uval = static_cast<uint32_t>(value);
        while (uval >= 0x80)
        {
            WriteByte(static_cast<uint8_t>((uval & 0x7F) | 0x80));
            uval >>= 7;
        }
        WriteByte(static_cast<uint8_t>(uval & 0x7F));
    }

    void CompactWriter::WriteString(const std::string &value)
    {
        WriteVarInt(static_cast<int32_t>(value.length()));
        WriteBytes(reinterpret_cast<const uint8_t *>(value.c_str()), value.length());
    }

    void CompactWriter::WriteBytes(const uint8_t *data, size_t length)
    {
        EnsureCapacity(length);
        std::memcpy(&currentBuffer_[position_], data, length);
        position_ += length;
    }

    std::vector<uint8_t> CompactWriter::GetBuffer()
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

        // Concatenate all buffers
        std::vector<uint8_t> result;
        result.reserve(totalSize);

        for (const auto &buffer : buffers_)
        {
            result.insert(result.end(), buffer.begin(), buffer.end());
        }

        return result;
    }

    void CompactWriter::Reset()
    {
        buffers_.clear();
        position_ = 0;
        currentBuffer_.resize(1024);
    }

    void CompactWriter::EnsureCapacity(size_t needed)
    {
        if (position_ + needed > currentBuffer_.size())
        {
            FlushCurrentBuffer();
            AllocateNewBuffer(std::max(needed * 2, static_cast<size_t>(1024)));
        }
    }

    void CompactWriter::FlushCurrentBuffer()
    {
        if (position_ > 0)
        {
            std::vector<uint8_t> buffer(position_);
            std::memcpy(buffer.data(), currentBuffer_.data(), position_);
            buffers_.push_back(std::move(buffer));
            position_ = 0;
        }
    }

    void CompactWriter::AllocateNewBuffer(size_t size)
    {
        currentBuffer_.resize(size);
        position_ = 0;
    }

} // namespace deukpack
