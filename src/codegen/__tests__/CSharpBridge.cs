using System;
using System.IO;
using System.Collections.Generic;
using DeukPack.Protocol;
using deuk.test;

namespace DeukPack.Test
{
    class CSharpBridge
    {
        static int Main(string[] args)
        {
            if (args.Length < 3)
            {
                Console.Error.WriteLine("Usage: CSharpBridge <protocol> <input_file> <output_file>");
                return 1;
            }

            string protocol = args[0].ToLower();
            string inputFile = args[1];
            string outputFile = args[2];

            Console.WriteLine($"[C#] Protocol: {protocol}");

            try
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
                    model.Nested = new NestedStruct
                    {
                        Inner_val = "nested_world",
                        Numbers = new List<int> { 1, 1, 2, 3, 5 }
                    };
                    model.Empty_nested = new NestedStruct
                    {
                        Inner_val = "",
                        Numbers = new List<int>()
                    };
                    model.Null_nested = new NestedStruct
                    {
                        Inner_val = "inner",
                        Numbers = new List<int>()
                    };
                    Console.WriteLine($"[C#] Initiated native model");
                }
                else
                {
                    byte[] inputData = File.ReadAllBytes(inputFile);
                    using var msIn = new MemoryStream(inputData);
                    
                    DpProtocol iprot;
                    if (protocol == "binary") iprot = new DpBinaryProtocol(msIn);
                    else if (protocol == "pack") iprot = new DpPackProtocol(msIn);
                    else if (protocol == "json") iprot = new DpJsonProtocol(msIn);
                    else throw new Exception($"Unknown protocol: {protocol}");

                    model.Read(iprot);
                    Console.WriteLine($"[C#] Read model. s_val: {model.S_val}");
                }

                using var msOut = new MemoryStream();
                DpProtocol oprot;
                if (protocol == "binary") oprot = new DpBinaryProtocol(msOut);
                else if (protocol == "pack") oprot = new DpPackProtocol(msOut);
                else if (protocol == "json") oprot = new DpJsonProtocol(msOut);
                else throw new Exception($"Unknown protocol: {protocol}");

                model.Write(oprot);
                File.WriteAllBytes(outputFile, msOut.ToArray());

                Console.WriteLine($"[C#] Successfully wrote {outputFile}");
                return 0;
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"[C#] Error: {e.Message}");
                Console.Error.WriteLine(e.StackTrace);
                return 1;
            }
        }
    }
}
