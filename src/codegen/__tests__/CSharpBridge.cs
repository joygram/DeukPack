using System;
using System.IO;
using System.Collections.Generic;
using DeukPack.Protocol;
using DefaultNamespace;

namespace DeukPack.Test
{
    class CSharpBridge
    {
        static int Main(string[] args)
        {
            if (args.Length < 3) return 1;

            string protocol = args[0].ToLower();
            string inputFile = args[1];
            string outputFile = args[2];
            Console.WriteLine($"[C#] Protocol: {protocol}");

            bool isComplex = inputFile.Contains("ComplexRoundtripModel") || outputFile.Contains("ComplexRoundtripModel");

            try
            {
                if (isComplex)
                {
                    var model = new ComplexRoundtripModel();
                    if (inputFile == "init")
                    {
                        model.B_val = false;
                        model.I8_val = 42;
                        model.I16_val = -1234;
                        model.I32_val = 987654321;
                        model.I64_val = -9223372036854775806L;
                        model.F_val = -1.23f;
                        model.D_val = 3.141592653589793;
                        model.S_val = "Complex 안녕하세요 \uD83C\uDF0E \u0001 \n \t";
                        model.Bin_val = new byte[] { 0, 255, 127, 128, 42 };
                        model.I8_neg = -127;
                        model.I16_neg = -32767;
                        model.I32_neg = -2147483647;
                        model.I64_neg = -9223372036854775806L;
                        model.F_neg = -999.5f;
                        model.D_neg = -1234567890.123;
                        model.S_empty = "";
                        model.Bin_empty = new byte[0];
                        model.I32_zero = 0;
                        model.I32_list = new List<int> { 0, 1, -1, 2147483647, -2147483647 };
                        model.I64_list = new List<long> { 0L, 1L, -1L, 9223372036854775806L, -9223372036854775806L };
                        model.S_list = new List<string> { "", "alpha", "beta", "gamma \uD83D\uDE80" };
                        model.B_list = new List<bool> { true, false, true, true };
                        model.D_list = new List<double> { 0.0, -0.0, 1.5, -1.5 };
                        model.I32_set = new HashSet<int> { 100, 200, 300 };
                        model.S_set = new HashSet<string> { "apple", "banana", "cherry" };
                        model.S_i32_map = new Dictionary<string, int> { { "", 0 }, { "one", 1 }, { "negative", -100 } };
                        model.S_d_map = new Dictionary<string, double> { { "pi", 3.141592653589793 }, { "e", 2.718281828459 } };
                        model.Address = new AddressStruct { City = "Seoul", Country = "KR", Zip_code = 12345 };
                        model.Address2 = new AddressStruct { City = "New York", Country = "US", Zip_code = 10001 };
                        model.Primary_tag = new TagStruct { Key = "environment", Value = "production", Aliases = new List<string> { "prod", "live" } };
                        model.Tags = new List<TagStruct> {
                            new TagStruct { Key = "tier", Value = "backend", Aliases = new List<string> { "server" } },
                            new TagStruct { Key = "region", Value = "ap-northeast-2", Aliases = new List<string> { "seoul" } },
                            new TagStruct { Key = "empty", Value = "", Aliases = new List<string>() }
                        };
                        model.Tag_lookup = new Dictionary<string, TagStruct> {
                            { "main", new TagStruct { Key = "main_key", Value = "main_val", Aliases = new List<string> { "m" } } },
                            { "fallback", new TagStruct { Key = "fb", Value = "fallback", Aliases = new List<string>() } }
                        };
                        model.Status = StatusEnum.Inactive;
                        model.Opt_null_str = "not_null";
                        model.Opt_null_bin = new byte[] { 255, 255 };
                        model.Opt_zero_i32 = 999;
                    }
                    else
                    {
                        byte[] inputData = File.ReadAllBytes(inputFile);
                        using var msIn = new MemoryStream(inputData);
                        DpProtocol iprot = protocol == "binary" ? new DpBinaryProtocol(msIn) : (protocol == "pack" ? new DpPackProtocol(msIn) : new DpJsonProtocol(msIn));
                        model.Read(iprot);
                    }

                    using var msOut = new MemoryStream();
                    DpProtocol oprot = protocol == "binary" ? new DpBinaryProtocol(msOut) : (protocol == "pack" ? new DpPackProtocol(msOut) : new DpJsonProtocol(msOut));
                    model.Write(oprot);
                    File.WriteAllBytes(outputFile, msOut.ToArray());
                }
                else
                {
                    var model = new RoundtripModel();
                    if (inputFile == "init")
                    {
                        model.B_val = true;
                        model.I8_val = 123;
                        model.I16_val = 1234;
                        model.I32_val = 123456;
                        model.I64_val = 1234567890123456789L;
                        model.F_val = 3.140000104904175f;
                        model.D_val = 2.718281828459;
                        model.S_val = "DeukPack Shared World";
                        model.Bin_val = new byte[] { 1, 2, 3, 4 };
                        model.I32_list = new List<int> { 10, 20, 30 };
                        model.S_list = new List<string> { "a", "b", "c" };
                        model.S_i32_map = new Dictionary<string, int> { { "key1", 100 }, { "key2", 200 } };
                        model.Nested = new NestedStruct { Inner_val = "nested_world", Numbers = new List<int> { 1, 1, 2, 3, 5 } };
                        model.Empty_nested = new NestedStruct { Inner_val = "", Numbers = new List<int>() };
                        model.Null_nested = new NestedStruct { Inner_val = "inner", Numbers = new List<int>() };
                    }
                    else
                    {
                        byte[] inputData = File.ReadAllBytes(inputFile);
                        using var msIn = new MemoryStream(inputData);
                        DpProtocol iprot = protocol == "binary" ? new DpBinaryProtocol(msIn) : (protocol == "pack" ? new DpPackProtocol(msIn) : new DpJsonProtocol(msIn));
                        model.Read(iprot);
                    }

                    using var msOut = new MemoryStream();
                    DpProtocol oprot = protocol == "binary" ? new DpBinaryProtocol(msOut) : (protocol == "pack" ? new DpPackProtocol(msOut) : new DpJsonProtocol(msOut));
                    model.Write(oprot);
                    File.WriteAllBytes(outputFile, msOut.ToArray());
                }

                return 0;
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"[C#] Error: {e.Message}");
                return 1;
            }
        }
    }
}
