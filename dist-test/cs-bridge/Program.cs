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
                byte[] inputData = File.ReadAllBytes(inputFile);
                using var msIn = new MemoryStream(inputData);
                
                DpProtocol iprot;
                if (protocol == "binary") iprot = new DpBinaryProtocol(msIn);
                else if (protocol == "pack") iprot = new DpPackProtocol(msIn);
                else if (protocol == "json") iprot = new DpJsonProtocol(msIn);
                else throw new Exception($"Unknown protocol: {protocol}");

                var model = new RoundtripModel();
                model.Read(iprot);

                Console.WriteLine($"[C#] Read model. s_val: {model.S_val}");

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
