#include "RoundtripModel_deuk.h"
#include "ComplexRoundtripModel_deuk.h"
#include "DpZeroCopy.h"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>

using namespace deuk::test;

int main(int argc, char** argv) {
    if (argc < 4) return 1;

    std::string protocol = argv[1];
    std::string inputFile = argv[2];
    std::string outputFile = argv[3];

    if (protocol == "json" || protocol == "compact" || protocol == "binary") {
        std::cerr << "[CPP] " << protocol << " not supported natively yet." << std::endl;
        if (inputFile != "init") {
            std::ofstream os(outputFile, std::ios::binary);
            os.close(); 
        }
        return 0;
    }

    bool isComplex = inputFile.find("ComplexRoundtripModel") != std::string::npos || outputFile.find("ComplexRoundtripModel") != std::string::npos;

    if (isComplex) {
        ComplexRoundtripModel model;
        if (inputFile == "init") {
            model.b_val = false;
            model.i8_val = 42;
            model.i16_val = -1234;
            model.i32_val = 987654321;
            model.i64_val = -9223372036854775806LL;
            model.f_val = -1.23f;
            model.d_val = 3.141592653589793;
            model.s_val = "Complex 안녕하세요 \xF0\x9F\x8C\x8E \x01 \n \t";
            model.bin_val = std::string(std::initializer_list<char>{0, (char)255, 127, (char)128, 42});
            model.i8_neg = -127;
            model.i16_neg = -32767;
            model.i32_neg = -2147483647;
            model.i64_neg = -9223372036854775806LL;
            model.f_neg = -999.5f;
            model.d_neg = -1234567890.123;
            model.s_empty = "";
            model.bin_empty = "";
            model.i32_zero = 0;
            model.i32_list = {0, 1, -1, 2147483647, -2147483647};
            model.i64_list = {0, 1, -1, 9223372036854775806LL, -9223372036854775806LL};
            model.s_list = {"", "alpha", "beta", "gamma \xF0\x9F\x9A\x80"};
            model.b_list = {true, false, true, true};
            model.d_list = {0.0, -0.0, 1.5, -1.5};
            model.i32_set = {100, 200, 300};
            model.s_set = {"apple", "banana", "cherry"};
            model.s_i32_map[""] = 0; model.s_i32_map["one"] = 1; model.s_i32_map["negative"] = -100;
            model.s_d_map["pi"] = 3.141592653589793; model.s_d_map["e"] = 2.718281828459045;
            
            AddressStruct addr1; addr1.city = "Seoul"; addr1.country = "KR"; addr1.zip_code = 12345;
            model.address = addr1;
            AddressStruct addr2; addr2.city = "New York"; addr2.country = "US"; addr2.zip_code = 10001;
            model.address2 = addr2;
            
            TagStruct t1; t1.key = "environment"; t1.value = "production"; t1.aliases = {"prod", "live"};
            model.primary_tag = t1;
            
            TagStruct t2; t2.key = "tier"; t2.value = "backend"; t2.aliases = {"server"};
            TagStruct t3; t3.key = "region"; t3.value = "ap-northeast-2"; t3.aliases = {"seoul"};
            TagStruct t4; t4.key = "empty"; t4.value = "";
            model.tags = {t2, t3, t4};
            
            TagStruct m1; m1.key = "main_key"; m1.value = "main_val"; m1.aliases = {"m"};
            TagStruct m2; m2.key = "fb"; m2.value = "fallback";
            model.tag_lookup["main"] = m1; model.tag_lookup["fallback"] = m2;
            
            model.status = StatusEnum::Inactive;
            model.opt_null_str = "not_null";
            model.opt_null_bin = std::string(std::initializer_list<char>{(char)255, (char)255});
            model.opt_zero_i32 = 999;
        } else {
            std::ifstream is(inputFile, std::ios::binary | std::ios::ate);
            if (is) {
                std::streamsize size = is.tellg();
                is.seekg(0, std::ios::beg);
                std::vector<char> buffer(size);
                if (is.read(buffer.data(), size)) {
                    try {
                        std::string bb(buffer.begin(), buffer.end());
                        model = ComplexRoundtripModel::UnpackV2(bb);
                    } catch (...) {}
                }
            }
        }
        std::ofstream os(outputFile, std::ios::binary);
        if (os) {
            std::string packed = model.PackV2();
            os.write(packed.data(), packed.size());
        }
    } else {
        RoundtripModel model;
        if (inputFile == "init") {
            model.b_val = true;
            model.i8_val = 123;
            model.i16_val = 1234;
            model.i32_val = 123456;
            model.i64_val = 1234567890123456789LL;
            model.f_val = 3.140000104904175f;
            model.d_val = 2.718281828459;
            model.s_val = "DeukPack Shared World";
            model.bin_val = std::string(std::initializer_list<char>{1, 2, 3, 4});
            model.i32_list = {10, 20, 30};
            model.s_list = {"a", "b", "c"};
            model.s_i32_map["key1"] = 100; model.s_i32_map["key2"] = 200;
            NestedStruct nested; nested.inner_val = "nested_world"; nested.numbers = {1, 1, 2, 3, 5};
            model.nested = nested;
            NestedStruct empty_nested; empty_nested.inner_val = "";
            model.empty_nested = empty_nested;
            NestedStruct null_nested; null_nested.inner_val = "inner";
            model.null_nested = null_nested;
        } else {
            std::ifstream is(inputFile, std::ios::binary | std::ios::ate);
            if (is) {
                std::streamsize size = is.tellg();
                is.seekg(0, std::ios::beg);
                std::vector<char> buffer(size);
                if (is.read(buffer.data(), size)) {
                    try {
                        std::string bb(buffer.begin(), buffer.end());
                        model = RoundtripModel::UnpackV2(bb);
                    } catch (...) {}
                }
            }
        }
        std::ofstream os(outputFile, std::ios::binary);
        if (os) {
            std::string packed = model.PackV2();
            os.write(packed.data(), packed.size());
        }
    }

    return 0;
}
