/**
 * Native C++ DeukPack Engine
 * Ultra-high performance serialization
 */

#include <node.h>
#include <v8.h>
#include <nan.h>
#include <iostream>
#include <vector>
#include <string>
#include <cstring>
#include <chrono>

using namespace v8;

class NativeDeukPackEngine {
private:
    std::vector<uint8_t> buffer;
    size_t offset;
    bool littleEndian;

    // High-performance serialization methods
    void writeI32(int32_t value) {
        if (littleEndian == isLittleEndian()) {
            memcpy(buffer.data() + offset, &value, sizeof(value));
        } else {
            uint8_t* bytes = reinterpret_cast<uint8_t*>(&value);
            for (int i = sizeof(value) - 1; i >= 0; --i) {
                buffer[offset + sizeof(value) - 1 - i] = bytes[i];
            }
        }
        offset += sizeof(value);
    }

    void writeString(const std::string& str) {
        writeI32(str.length());
        memcpy(buffer.data() + offset, str.c_str(), str.length());
        offset += str.length();
    }

    void writeBool(bool value) {
        buffer[offset] = value ? 1 : 0;
        offset += 1;
    }

    void writeDouble(double value) {
        if (littleEndian == isLittleEndian()) {
            memcpy(buffer.data() + offset, &value, sizeof(value));
        } else {
            uint8_t* bytes = reinterpret_cast<uint8_t*>(&value);
            for (int i = sizeof(value) - 1; i >= 0; --i) {
                buffer[offset + sizeof(value) - 1 - i] = bytes[i];
            }
        }
        offset += sizeof(value);
    }

    bool isLittleEndian() {
        uint16_t test = 0x0001;
        return *reinterpret_cast<uint8_t*>(&test) == 1;
    }

public:
    NativeDeukPackEngine() : offset(0), littleEndian(true) {
        buffer.resize(1024 * 1024); // 1MB buffer
    }

    // Ultra-fast serialization
    void serialize(const Local<Object>& data) {
        offset = 0; // Reset offset

        // Extract values from JavaScript object
        Local<Value> idValue = data->Get(Nan::New("id").ToLocalChecked());
        Local<Value> nameValue = data->Get(Nan::New("name").ToLocalChecked());
        Local<Value> damageValue = data->Get(Nan::New("damage").ToLocalChecked());
        Local<Value> levelValue = data->Get(Nan::New("level").ToLocalChecked());
        Local<Value> activeValue = data->Get(Nan::New("active").ToLocalChecked());

        // Serialize with maximum performance
        writeI32(idValue->Int32Value());

        std::string name = *Nan::Utf8String(nameValue);
        writeString(name);

        writeI32(damageValue->Int32Value());
        writeI32(levelValue->Int32Value());
        writeBool(activeValue->BooleanValue());

        // Serialize stats array
        Local<Value> statsValue = data->Get(Nan::New("stats").ToLocalChecked());
        if (statsValue->IsArray()) {
            Local<Array> stats = Local<Array>::Cast(statsValue);
            writeI32(stats->Length());

            for (uint32_t i = 0; i < stats->Length(); i++) {
                Local<Value> statValue = stats->Get(i);
                writeI32(statValue->Int32Value());
            }
        }
    }

    // Get serialized buffer
    Local<ArrayBuffer> getBuffer() {
        return ArrayBuffer::New(Isolate::GetCurrent(), buffer.data(), offset);
    }

    // Performance test method
    static void PerformanceTest(const Nan::FunctionCallbackInfo<Value>& args) {
        auto start = std::chrono::high_resolution_clock::now();

        NativeDeukPackEngine engine;
        Local<Object> data = args[0]->ToObject();

        // Run multiple iterations for accurate timing
        int iterations = args[1]->Int32Value();
        for (int i = 0; i < iterations; i++) {
            engine.serialize(data);
        }

        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);

        Local<Object> result = Nan::New<Object>();
        result->Set(Nan::New("duration").ToLocalChecked(), Nan::New<Number>(duration.count()));
        result->Set(Nan::New("iterations").ToLocalChecked(), Nan::New<Number>(iterations));
        result->Set(Nan::New("opsPerSecond").ToLocalChecked(),
                   Nan::New<Number>((double)iterations / (duration.count() / 1000000.0)));

        args.GetReturnValue().Set(result);
    }
};

// Node.js module initialization
NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("NativeDeukPackEngine").ToLocalChecked(),
             Nan::GetFunction(Nan::New<FunctionTemplate>(NativeDeukPackEngine::PerformanceTest)).ToLocalChecked());
}

NODE_MODULE(native_deukpack_engine, Init)
