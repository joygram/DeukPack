/**
 * DeukPack Native C++ Implementation
 * High-performance wire engine (binary/compact). OSS: no thrift naming.
 */

#include <napi.h>
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <memory>
#include <chrono>
#include "wire_engine.h"
#include "binary_writer.h"

using namespace deukpack;

// WireEngine implementation
class WireEngine::Impl
{
public:
    Impl() : memoryUsage_(0) {}

    WireAst ParseFiles(const std::vector<std::string> &filePaths)
    {
        auto start = std::chrono::high_resolution_clock::now();

        WireAst ast;
        // TODO: Implement actual parsing logic
        // For now, return empty AST

        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        parseTime_ = duration.count();

        return ast;
    }

    std::vector<uint8_t> Serialize(const std::unordered_map<std::string, std::string> &data,
                                   const SerializationOptions &options)
    {
        auto start = std::chrono::high_resolution_clock::now();

        BinaryWriter writer(options.endianness == Endianness::Little ? Endianness::Little : Endianness::Big);

        // Simple serialization for demonstration
        writer.WriteI32(static_cast<int32_t>(data.size()));
        for (const auto &pair : data)
        {
            writer.WriteString(pair.first);
            writer.WriteString(pair.second);
        }

        auto result = writer.GetBuffer();

        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        serializeTime_ = duration.count();

        return result;
    }

    std::unordered_map<std::string, std::string> Deserialize(const std::vector<uint8_t> &data,
                                                             const SerializationOptions &options)
    {
        auto start = std::chrono::high_resolution_clock::now();

        std::unordered_map<std::string, std::string> result;

        // Simple deserialization for demonstration
        if (data.size() >= 4)
        {
            int32_t count = *reinterpret_cast<const int32_t *>(data.data());
            size_t offset = 4;

            for (int32_t i = 0; i < count && offset < data.size(); i++)
            {
                if (offset + 4 > data.size())
                    break;

                int32_t keyLen = *reinterpret_cast<const int32_t *>(data.data() + offset);
                offset += 4;

                if (offset + keyLen > data.size())
                    break;
                std::string key(data.data() + offset, data.data() + offset + keyLen);
                offset += keyLen;

                if (offset + 4 > data.size())
                    break;
                int32_t valueLen = *reinterpret_cast<const int32_t *>(data.data() + offset);
                offset += 4;

                if (offset + valueLen > data.size())
                    break;
                std::string value(data.data() + offset, data.data() + offset + valueLen);
                offset += valueLen;

                result[key] = value;
            }
        }

        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        deserializeTime_ = duration.count();

        return result;
    }

    size_t GetMemoryUsage() const
    {
        return memoryUsage_;
    }

    PerformanceMetrics GetPerformanceMetrics() const
    {
        PerformanceMetrics metrics;
        metrics.parseTime = parseTime_;
        metrics.generateTime = generateTime_;
        metrics.serializeTime = serializeTime_;
        metrics.deserializeTime = deserializeTime_;
        metrics.memoryUsage = memoryUsage_;
        metrics.fileCount = fileCount_;
        metrics.lineCount = lineCount_;
        return metrics;
    }

    void ResetMetrics()
    {
        parseTime_ = 0;
        generateTime_ = 0;
        serializeTime_ = 0;
        deserializeTime_ = 0;
        memoryUsage_ = 0;
        fileCount_ = 0;
        lineCount_ = 0;
    }

private:
    double parseTime_ = 0;
    double generateTime_ = 0;
    double serializeTime_ = 0;
    double deserializeTime_ = 0;
    size_t memoryUsage_ = 0;
    int32_t fileCount_ = 0;
    int32_t lineCount_ = 0;
};

WireEngine::WireEngine() : impl_(std::make_unique<Impl>()) {}
WireEngine::~WireEngine() = default;

WireAst WireEngine::ParseFiles(const std::vector<std::string> &filePaths)
{
    return impl_->ParseFiles(filePaths);
}

std::vector<uint8_t> WireEngine::Serialize(const std::unordered_map<std::string, std::string> &data,
                                            const SerializationOptions &options)
{
    return impl_->Serialize(data, options);
}

std::unordered_map<std::string, std::string> WireEngine::Deserialize(const std::vector<uint8_t> &data,
                                                                       const SerializationOptions &options)
{
    return impl_->Deserialize(data, options);
}

size_t WireEngine::GetMemoryUsage() const
{
    return impl_->GetMemoryUsage();
}

PerformanceMetrics WireEngine::GetPerformanceMetrics() const
{
    return impl_->GetPerformanceMetrics();
}

void WireEngine::ResetMetrics()
{
    impl_->ResetMetrics();
}

// N-API wrapper functions
Napi::Value CreateEngine(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    try
    {
        auto engine = std::make_unique<WireEngine>();
        return Napi::External<WireEngine>::New(env, engine.release());
    }
    catch (const std::exception &e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value ParseFiles(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsExternal() || !info[1].IsArray())
    {
        Napi::TypeError::New(env, "Expected engine and file paths array").ThrowAsJavaScriptException();
        return env.Null();
    }

    try
    {
        auto engine = info[0].As<Napi::External<WireEngine>>().Data();
        auto filePaths = info[1].As<Napi::Array>();

        std::vector<std::string> paths;
        for (uint32_t i = 0; i < filePaths.Length(); i++)
        {
            if (filePaths.Get(i).IsString())
            {
                paths.push_back(filePaths.Get(i).As<Napi::String>().Utf8Value());
            }
        }

        auto ast = engine->ParseFiles(paths);

        // Convert AST to JavaScript object
        auto result = Napi::Object::New(env);
        result.Set("namespaces", Napi::Array::New(env));
        result.Set("structs", Napi::Array::New(env));
        result.Set("enums", Napi::Array::New(env));
        result.Set("services", Napi::Array::New(env));
        result.Set("includes", Napi::Array::New(env));

        return result;
    }
    catch (const std::exception &e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value Serialize(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsExternal() || !info[1].IsObject() || !info[2].IsObject())
    {
        Napi::TypeError::New(env, "Expected engine, data object, and options object").ThrowAsJavaScriptException();
        return env.Null();
    }

    try
    {
        auto engine = info[0].As<Napi::External<WireEngine>>().Data();
        auto dataObj = info[1].As<Napi::Object>();
        (void)info[2].As<Napi::Object>(); // options object validated above

        // Convert JavaScript object to map
        std::unordered_map<std::string, std::string> data;
        auto keys = dataObj.GetPropertyNames();
        for (uint32_t i = 0; i < keys.Length(); i++)
        {
            auto key = keys.Get(i).As<Napi::String>().Utf8Value();
            auto value = dataObj.Get(key).As<Napi::String>().Utf8Value();
            data[key] = value;
        }

        // Create serialization options
        SerializationOptions options;
        options.protocol = WireProtocol::Binary;
        options.endianness = Endianness::Little;
        options.optimizeForSize = true;
        options.includeDefaultValues = false;
        options.validateTypes = true;

        auto result = engine->Serialize(data, options);

        // Convert to Node.js Buffer
        auto buffer = Napi::Buffer<uint8_t>::Copy(env, result.data(), result.size());
        return buffer;
    }
    catch (const std::exception &e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value Deserialize(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsExternal() || !info[1].IsBuffer() || !info[2].IsObject())
    {
        Napi::TypeError::New(env, "Expected engine, buffer, and options object").ThrowAsJavaScriptException();
        return env.Null();
    }

    try
    {
        auto engine = info[0].As<Napi::External<WireEngine>>().Data();
        auto buffer = info[1].As<Napi::Buffer<uint8_t>>();
        (void)info[2].As<Napi::Object>(); // options object validated above

        // Convert buffer to vector
        std::vector<uint8_t> data(buffer.Data(), buffer.Data() + buffer.Length());

        // Create serialization options
        SerializationOptions options;
        options.protocol = WireProtocol::Binary;
        options.endianness = Endianness::Little;
        options.optimizeForSize = true;
        options.includeDefaultValues = false;
        options.validateTypes = true;

        auto result = engine->Deserialize(data, options);

        // Convert map to JavaScript object
        auto resultObj = Napi::Object::New(env);
        for (const auto &pair : result)
        {
            resultObj.Set(pair.first, pair.second);
        }

        return resultObj;
    }
    catch (const std::exception &e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value GetPerformanceMetrics(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsExternal())
    {
        Napi::TypeError::New(env, "Expected engine").ThrowAsJavaScriptException();
        return env.Null();
    }

    try
    {
        auto engine = info[0].As<Napi::External<WireEngine>>().Data();
        auto metrics = engine->GetPerformanceMetrics();

        auto result = Napi::Object::New(env);
        result.Set("parseTime", metrics.parseTime);
        result.Set("generateTime", metrics.generateTime);
        result.Set("serializeTime", metrics.serializeTime);
        result.Set("deserializeTime", metrics.deserializeTime);
        result.Set("memoryUsage", static_cast<double>(metrics.memoryUsage));
        result.Set("fileCount", metrics.fileCount);
        result.Set("lineCount", metrics.lineCount);

        return result;
    }
    catch (const std::exception &e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "createEngine"), Napi::Function::New(env, CreateEngine));
    exports.Set(Napi::String::New(env, "parseFiles"), Napi::Function::New(env, ParseFiles));
    exports.Set(Napi::String::New(env, "serialize"), Napi::Function::New(env, Serialize));
    exports.Set(Napi::String::New(env, "deserialize"), Napi::Function::New(env, Deserialize));
    exports.Set(Napi::String::New(env, "getPerformanceMetrics"), Napi::Function::New(env, GetPerformanceMetrics));

    return exports;
}

NODE_API_MODULE(deukpack_wire_engine, Init)
