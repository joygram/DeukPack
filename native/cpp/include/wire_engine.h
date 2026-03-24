/**
 * DeukPack Native C++ Header
 * High-performance wire engine (binary/compact); identifiers C#-style.
 * All guards/defines use DEUKPACK_ prefix to avoid clashes with system or other libs.
 * OSS: no "thrift" naming; Wire/Dp naming only.
 */

#ifndef DEUKPACK_WIRE_ENGINE_H
#define DEUKPACK_WIRE_ENGINE_H

#include <cstdint>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <chrono>

/* Avoid collision with system macros (e.g. from endian.h). We use enum Endianness::Little/Big only. */
#ifdef LITTLE_ENDIAN
#define DEUKPACK_SAVED_LITTLE_ENDIAN LITTLE_ENDIAN
#undef LITTLE_ENDIAN
#endif
#ifdef BIG_ENDIAN
#define DEUKPACK_SAVED_BIG_ENDIAN BIG_ENDIAN
#undef BIG_ENDIAN
#endif

namespace deukpack
{

    // Forward declarations
    struct WireAst;
    struct WireStruct;
    struct WireEnum;
    struct WireService;
    struct WireField;
    struct WireNamespace;
    struct SerializationOptions;

    // Wire types (C#-style PascalCase)
    enum class WireType
    {
        Bool,
        Byte,
        I16,
        I32,
        I64,
        Double,
        String,
        Binary,
        List,
        Set,
        Map,
        Struct,
        Enum
    };

    enum class Endianness
    {
        Little,
        Big
    };

    enum class WireProtocol
    {
        Binary,
        Compact,
        Json
    };

    // Field definition
    struct WireField
    {
        int32_t id;
        std::string name;
        WireType type;
        bool required;
        std::string defaultValue;
        WireType elementType;
        WireType keyType;
        WireType valueType;
        std::string structType;
        std::unordered_map<std::string, int32_t> enumValues;
    };

    // Struct definition
    struct WireStruct
    {
        std::string name;
        std::vector<WireField> fields;
        std::unordered_map<std::string, std::string> annotations;
    };

    // Enum definition
    struct WireEnum
    {
        std::string name;
        std::unordered_map<std::string, int32_t> values;
        std::unordered_map<std::string, std::string> annotations;
    };

    // Method definition
    struct WireMethod
    {
        std::string name;
        WireType returnType;
        std::vector<WireField> parameters;
        bool oneway;
        std::unordered_map<std::string, std::string> annotations;
    };

    // Service definition
    struct WireService
    {
        std::string name;
        std::vector<WireMethod> methods;
        std::unordered_map<std::string, std::string> annotations;
    };

    // Namespace definition
    struct WireNamespace
    {
        std::string language;
        std::string name;
    };

    // AST
    struct WireAst
    {
        std::vector<WireNamespace> namespaces;
        std::vector<WireStruct> structs;
        std::vector<WireEnum> enums;
        std::vector<WireService> services;
        std::vector<std::string> includes;
        std::unordered_map<std::string, std::string> annotations;
    };

    // Serialization options
    struct SerializationOptions
    {
        WireProtocol protocol;
        Endianness endianness;
        bool optimizeForSize;
        bool includeDefaultValues;
        bool validateTypes;
    };

    // Performance metrics
    struct PerformanceMetrics
    {
        double parseTime;
        double generateTime;
        double serializeTime;
        double deserializeTime;
        size_t memoryUsage;
        int32_t fileCount;
        int32_t lineCount;
    };

    // Main wire engine class
    class WireEngine
    {
    public:
        WireEngine();
        ~WireEngine();

        // Parse IDL files
        WireAst ParseFiles(const std::vector<std::string> &filePaths);

        // Serialize object
        std::vector<uint8_t> Serialize(const std::unordered_map<std::string, std::string> &data, const SerializationOptions &options);

        // Deserialize data
        std::unordered_map<std::string, std::string> Deserialize(const std::vector<uint8_t> &data, const SerializationOptions &options);

        // Get memory usage
        size_t GetMemoryUsage() const;

        // Get performance metrics
        PerformanceMetrics GetPerformanceMetrics() const;

        // Reset metrics
        void ResetMetrics();

    private:
        class Impl;
        std::unique_ptr<Impl> impl_;
    };

    // Utility functions (inline — no separate .cpp needed)
    inline std::string WireTypeToString(WireType type) {
        switch (type) {
            case WireType::Bool:   return "bool";
            case WireType::Byte:   return "byte";
            case WireType::I16:    return "int16";
            case WireType::I32:    return "int32";
            case WireType::I64:    return "int64";
            case WireType::Double: return "double";
            case WireType::String: return "string";
            case WireType::Binary: return "binary";
            case WireType::List:   return "list";
            case WireType::Set:    return "set";
            case WireType::Map:    return "map";
            case WireType::Struct: return "struct";
            case WireType::Enum:   return "enum";
            default: return "unknown";
        }
    }
    inline WireType StringToWireType(const std::string &str) {
        if (str == "bool")   return WireType::Bool;
        if (str == "byte")   return WireType::Byte;
        if (str == "int16" || str == "i16") return WireType::I16;
        if (str == "int32" || str == "i32") return WireType::I32;
        if (str == "int64" || str == "i64") return WireType::I64;
        if (str == "double") return WireType::Double;
        if (str == "string") return WireType::String;
        if (str == "binary") return WireType::Binary;
        if (str == "list")   return WireType::List;
        if (str == "set")    return WireType::Set;
        if (str == "map")    return WireType::Map;
        if (str == "struct") return WireType::Struct;
        if (str == "enum")   return WireType::Enum;
        return WireType::String;
    }
    inline std::string EndiannessToString(Endianness endianness) {
        return endianness == Endianness::Big ? "big" : "little";
    }
    inline Endianness StringToEndianness(const std::string &str) {
        return str == "big" ? Endianness::Big : Endianness::Little;
    }
    inline std::string WireProtocolToString(WireProtocol protocol) {
        switch (protocol) {
            case WireProtocol::Binary:  return "binary";
            case WireProtocol::Compact: return "compact";
            case WireProtocol::Json:    return "json";
            default: return "binary";
        }
    }
    inline WireProtocol StringToWireProtocol(const std::string &str) {
        if (str == "compact") return WireProtocol::Compact;
        if (str == "json")    return WireProtocol::Json;
        return WireProtocol::Binary;
    }

} // namespace deukpack

#ifdef DEUKPACK_SAVED_LITTLE_ENDIAN
#define LITTLE_ENDIAN DEUKPACK_SAVED_LITTLE_ENDIAN
#undef DEUKPACK_SAVED_LITTLE_ENDIAN
#endif
#ifdef DEUKPACK_SAVED_BIG_ENDIAN
#define BIG_ENDIAN DEUKPACK_SAVED_BIG_ENDIAN
#undef DEUKPACK_SAVED_BIG_ENDIAN
#endif

#endif // DEUKPACK_WIRE_ENGINE_H
