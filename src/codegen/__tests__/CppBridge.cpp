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

    // Step 1: Read input
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

    RoundtripModel model;
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
