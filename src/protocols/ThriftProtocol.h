/**
 * DeukPack Thrift Protocol Library for C++
 * Cross-platform serialization with endian support
 */

#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include <memory>

namespace DeukPack
{
    namespace Thrift
    {

        enum class TType : uint8_t
        {
            Stop = 0,
            Void = 1,
            Bool = 2,
            Byte = 3,
            Double = 4,
            I16 = 6,
            I32 = 8,
            I64 = 10,
            String = 11,
            Struct = 12,
            Map = 13,
            Set = 14,
            List = 15
        };

        enum class TMessageType : uint8_t
        {
            Call = 1,
            Reply = 2,
            Exception = 3,
            Oneway = 4
        };

        struct TStruct
        {
            std::string name;
        };

        struct TField
        {
            std::string name;
            TType type;
            int16_t id;
        };

        struct TList
        {
            TType elementType;
            int32_t count;
        };

        struct TSet
        {
            TType elementType;
            int32_t count;
        };

        struct TMap
        {
            TType keyType;
            TType valueType;
            int32_t count;
        };

        class TProtocol
        {
        public:
            virtual ~TProtocol() = default;

            virtual void writeStructBegin(const TStruct &structBegin) = 0;
            virtual void writeStructEnd() = 0;
            virtual void writeFieldBegin(const TField &field) = 0;
            virtual void writeFieldEnd() = 0;
            virtual void writeFieldStop() = 0;
            virtual void writeBool(bool value) = 0;
            virtual void writeByte(uint8_t value) = 0;
            virtual void writeI16(int16_t value) = 0;
            virtual void writeI32(int32_t value) = 0;
            virtual void writeI64(int64_t value) = 0;
            virtual void writeDouble(double value) = 0;
            virtual void writeString(const std::string &value) = 0;
            virtual void writeBinary(const std::vector<uint8_t> &value) = 0;
            virtual void writeListBegin(const TList &list) = 0;
            virtual void writeListEnd() = 0;
            virtual void writeSetBegin(const TSet &set) = 0;
            virtual void writeSetEnd() = 0;
            virtual void writeMapBegin(const TMap &map) = 0;
            virtual void writeMapEnd() = 0;

            virtual TStruct readStructBegin() = 0;
            virtual void readStructEnd() = 0;
            virtual TField readFieldBegin() = 0;
            virtual void readFieldEnd() = 0;
            virtual bool readBool() = 0;
            virtual uint8_t readByte() = 0;
            virtual int16_t readI16() = 0;
            virtual int32_t readI32() = 0;
            virtual int64_t readI64() = 0;
            virtual double readDouble() = 0;
            virtual std::string readString() = 0;
            virtual std::vector<uint8_t> readBinary() = 0;
            virtual TList readListBegin() = 0;
            virtual void readListEnd() = 0;
            virtual TSet readSetBegin() = 0;
            virtual void readSetEnd() = 0;
            virtual TMap readMapBegin() = 0;
            virtual void readMapEnd() = 0;
        };

        /**
         * Binary protocol with endian support
         */
        class TBinaryProtocol : public TProtocol
        {
        private:
            std::vector<uint8_t> buffer_;
            size_t offset_;
            bool littleEndian_;

            template <typename T>
            void writeValue(T value)
            {
                if (littleEndian_ == isLittleEndian())
                {
                    // Same endianness, direct copy
                    const uint8_t *bytes = reinterpret_cast<const uint8_t *>(&value);
                    buffer_.insert(buffer_.end(), bytes, bytes + sizeof(T));
                }
                else
                {
                    // Different endianness, reverse bytes
                    const uint8_t *bytes = reinterpret_cast<const uint8_t *>(&value);
                    for (int i = sizeof(T) - 1; i >= 0; --i)
                    {
                        buffer_.push_back(bytes[i]);
                    }
                }
                offset_ += sizeof(T);
            }

            template <typename T>
            T readValue()
            {
                T value;
                if (littleEndian_ == isLittleEndian())
                {
                    // Same endianness, direct copy
                    std::memcpy(&value, &buffer_[offset_], sizeof(T));
                }
                else
                {
                    // Different endianness, reverse bytes
                    for (int i = 0; i < sizeof(T); ++i)
                    {
                        reinterpret_cast<uint8_t *>(&value)[i] = buffer_[offset_ + sizeof(T) - 1 - i];
                    }
                }
                offset_ += sizeof(T);
                return value;
            }

            static bool isLittleEndian()
            {
                uint16_t test = 0x0001;
                return *reinterpret_cast<uint8_t *>(&test) == 1;
            }

        public:
            TBinaryProtocol(bool littleEndian = true) : offset_(0), littleEndian_(littleEndian) {}

            void writeStructBegin(const TStruct &structBegin) override
            {
                // Binary protocol doesn't write struct names
            }

            void writeStructEnd() override
            {
                // Binary protocol doesn't write struct end markers
            }

            void writeFieldBegin(const TField &field) override
            {
                writeByte(static_cast<uint8_t>(field.type));
                writeI16(field.id);
            }

            void writeFieldEnd() override
            {
                // Binary protocol doesn't write field end markers
            }

            void writeFieldStop() override
            {
                writeByte(static_cast<uint8_t>(TType::Stop));
            }

            void writeBool(bool value) override
            {
                writeByte(value ? 1 : 0);
            }

            void writeByte(uint8_t value) override
            {
                buffer_.push_back(value);
                offset_++;
            }

            void writeI16(int16_t value) override
            {
                writeValue(value);
            }

            void writeI32(int32_t value) override
            {
                writeValue(value);
            }

            void writeI64(int64_t value) override
            {
                writeValue(value);
            }

            void writeDouble(double value) override
            {
                writeValue(value);
            }

            void writeString(const std::string &value) override
            {
                writeI32(static_cast<int32_t>(value.length()));
                buffer_.insert(buffer_.end(), value.begin(), value.end());
                offset_ += value.length();
            }

            void writeBinary(const std::vector<uint8_t> &value) override
            {
                writeI32(static_cast<int32_t>(value.size()));
                buffer_.insert(buffer_.end(), value.begin(), value.end());
                offset_ += value.size();
            }

            void writeListBegin(const TList &list) override
            {
                writeByte(static_cast<uint8_t>(list.elementType));
                writeI32(list.count);
            }

            void writeListEnd() override
            {
                // Binary protocol doesn't write list end markers
            }

            void writeSetBegin(const TSet &set) override
            {
                writeByte(static_cast<uint8_t>(set.elementType));
                writeI32(set.count);
            }

            void writeSetEnd() override
            {
                // Binary protocol doesn't write set end markers
            }

            void writeMapBegin(const TMap &map) override
            {
                writeByte(static_cast<uint8_t>(map.keyType));
                writeByte(static_cast<uint8_t>(map.valueType));
                writeI32(map.count);
            }

            void writeMapEnd() override
            {
                // Binary protocol doesn't write map end markers
            }

            TStruct readStructBegin() override
            {
                return TStruct{};
            }

            void readStructEnd() override
            {
                // Binary protocol doesn't read struct end markers
            }

            TField readFieldBegin() override
            {
                uint8_t type = readByte();
                if (type == static_cast<uint8_t>(TType::Stop))
                {
                    return TField{"", TType::Stop, 0};
                }
                int16_t id = readI16();
                return TField{"", static_cast<TType>(type), id};
            }

            void readFieldEnd() override
            {
                // Binary protocol doesn't read field end markers
            }

            bool readBool() override
            {
                return readByte() != 0;
            }

            uint8_t readByte() override
            {
                if (offset_ >= buffer_.size())
                {
                    throw std::runtime_error("End of buffer");
                }
                return buffer_[offset_++];
            }

            int16_t readI16() override
            {
                return readValue<int16_t>();
            }

            int32_t readI32() override
            {
                return readValue<int32_t>();
            }

            int64_t readI64() override
            {
                return readValue<int64_t>();
            }

            double readDouble() override
            {
                return readValue<double>();
            }

            std::string readString() override
            {
                int32_t length = readI32();
                if (offset_ + length > buffer_.size())
                {
                    throw std::runtime_error("End of buffer");
                }
                std::string result(buffer_.begin() + offset_, buffer_.begin() + offset_ + length);
                offset_ += length;
                return result;
            }

            std::vector<uint8_t> readBinary() override
            {
                int32_t length = readI32();
                if (offset_ + length > buffer_.size())
                {
                    throw std::runtime_error("End of buffer");
                }
                std::vector<uint8_t> result(buffer_.begin() + offset_, buffer_.begin() + offset_ + length);
                offset_ += length;
                return result;
            }

            TList readListBegin() override
            {
                uint8_t elementType = readByte();
                int32_t count = readI32();
                return TList{static_cast<TType>(elementType), count};
            }

            void readListEnd() override
            {
                // Binary protocol doesn't read list end markers
            }

            TSet readSetBegin() override
            {
                uint8_t elementType = readByte();
                int32_t count = readI32();
                return TSet{static_cast<TType>(elementType), count};
            }

            void readSetEnd() override
            {
                // Binary protocol doesn't read set end markers
            }

            TMap readMapBegin() override
            {
                uint8_t keyType = readByte();
                uint8_t valueType = readByte();
                int32_t count = readI32();
                return TMap{static_cast<TType>(keyType), static_cast<TType>(valueType), count};
            }

            void readMapEnd() override
            {
                // Binary protocol doesn't read map end markers
            }

            // Utility methods
            const std::vector<uint8_t> &getBuffer() const
            {
                return buffer_;
            }

            size_t getOffset() const
            {
                return offset_;
            }

            void setOffset(size_t offset)
            {
                offset_ = offset;
            }

            void setBuffer(const std::vector<uint8_t> &buffer)
            {
                buffer_ = buffer;
                offset_ = 0;
            }
        };

    } // namespace Thrift
} // namespace DeukPack
