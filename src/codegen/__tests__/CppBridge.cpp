#include "RoundtripModel_deuk.h"
#include "DpBinaryProtocol.h"
#include "DpPackProtocol.h"
#include "DpJsonProtocol.h"
#include <iostream>
#include <fstream>
#include <memory>
#include <string>
#include <vector>

using namespace deuk::test;

int main(int argc, char** argv) {
    if (argc < 4) {
        std::cerr << "Usage: CppBridge <protocol> <input_file> <output_file>" << std::endl;
        return 1;
    }

    std::string protocol = argv[1];
    std::string inputFile = argv[2];
    std::string outputFile = argv[3];
    std::cout << "[CPP] Protocol: " << protocol << ", Input: " << inputFile << ", Output: " << outputFile << std::endl;

    RoundtripModel model;
    
    if (inputFile == "init") {
        model.b_val = std::make_shared<bool>(true);
        model.i8_val = std::make_shared<int8_t>(123);
        model.i16_val = std::make_shared<int16_t>(1234);
        model.i32_val = std::make_shared<int32_t>(123456);
        model.i64_val = std::make_shared<int64_t>(1234567890123456789LL);
        model.f_val = std::make_shared<float>(3.140000104904175f);
        model.d_val = std::make_shared<double>(2.718281828459);
        model.s_val = std::make_shared<std::string>("DeukPack Shared World");
        
        std::string bin_str;
        bin_str.push_back((char)1); bin_str.push_back((char)2); bin_str.push_back((char)3); bin_str.push_back((char)4);
        model.bin_val = std::make_shared<std::string>(bin_str);

        model.i32_list = std::make_shared<std::vector<int32_t>>(std::initializer_list<int32_t>{10, 20, 30});
        model.s_list = std::make_shared<std::vector<std::string>>(std::initializer_list<std::string>{"a", "b", "c"});
        
        std::map<std::string, int32_t> s_i32_map;
        s_i32_map["key1"] = 100; s_i32_map["key2"] = 200;
        model.s_i32_map = std::make_shared<std::map<std::string, int32_t>>(s_i32_map);
        
        NestedStruct nested;
        nested.inner_val = std::make_shared<std::string>("nested_world");
        nested.numbers = std::make_shared<std::vector<int32_t>>(std::initializer_list<int32_t>{1, 1, 2, 3, 5});
        model.nested = std::make_shared<NestedStruct>(nested);
        
        NestedStruct empty_nested;
        empty_nested.inner_val = std::make_shared<std::string>("");
        empty_nested.numbers = std::make_shared<std::vector<int32_t>>();
        model.empty_nested = std::make_shared<NestedStruct>(empty_nested);
        
        NestedStruct null_nested;
        null_nested.inner_val = std::make_shared<std::string>("inner");
        null_nested.numbers = std::make_shared<std::vector<int32_t>>();
        model.null_nested = std::make_shared<NestedStruct>(null_nested);
        
        std::cout << "[CPP] Initiated native model" << std::endl;
    } else {
        std::ifstream is(inputFile, std::ios::binary);
        if (!is) {
            std::cerr << "Failed to open " << inputFile << std::endl;
            return 1;
        }

        std::unique_ptr<deuk::DpProtocol> iprot;
        if (protocol == "binary") {
            iprot = std::make_unique<deuk::DpBinaryProtocol>(&is);
        } else if (protocol == "pack") {
            iprot = std::make_unique<deuk::DpPackProtocol>(&is);
        } else if (protocol == "json") {
            iprot = std::make_unique<deuk::DpJsonProtocol>(&is);
        } else {
            std::cerr << "Unknown protocol: " << protocol << std::endl;
            return 1;
        }

        try {
            model.Read(*iprot);
        } catch (const std::exception& e) {
            std::cerr << "Read error: " << e.what() << std::endl;
            return 1;
        }
        is.close();

        if (model.s_val) {
            std::cout << "[CPP] Read s_val: " << *model.s_val << std::endl;
        }
    }

    if (model.s_val) {
        std::cout << "[CPP] Read s_val: " << *model.s_val << std::endl;
    }

    // Step 2: Write to output
    std::ofstream os(outputFile, std::ios::binary);
    if (!os) {
        std::cerr << "Failed to open " << outputFile << std::endl;
        return 1;
    }
    std::unique_ptr<deuk::DpProtocol> oprot;
    if (protocol == "binary") {
        oprot = std::make_unique<deuk::DpBinaryProtocol>(&os);
    } else if (protocol == "pack") {
        oprot = std::make_unique<deuk::DpPackProtocol>(&os);
    } else if (protocol == "json") {
        oprot = std::make_unique<deuk::DpJsonProtocol>(&os);
    }

    try {
        model.Write(*oprot);
    } catch (const std::exception& e) {
        std::cerr << "Write error: " << e.what() << std::endl;
        return 1;
    }
    os.close();

    std::cout << "[CPP] Successfully wrote " << outputFile << std::endl;
    return 0;
}
