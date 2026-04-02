import com.deukpack.generated.*;
import java.io.*;
import java.util.*;

public class JavaBridge {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: java JavaBridge <protocol> <input_file> <output_file>");
            System.exit(1);
        }

        String protocol = args[0].toLowerCase();
        String inputFile = args[1];
        String outputFile = args[2];

        System.out.println("[Java] Protocol: " + protocol + ", Input: " + inputFile + ", Output: " + outputFile);

        RoundtripModel model = new RoundtripModel();

        if (inputFile.equals("init")) {
            model.setB_val(true);
            model.setI8_val((byte)123);
            model.setI16_val((short)1234);
            model.setI32_val(123456);
            model.setI64_val(1234567890123456789L);
            model.setF_val(3.140000104904175f);
            model.setD_val(2.718281828459);
            model.setS_val("DeukPack Shared World");
            model.setBin_val(new byte[]{1, 2, 3, 4});
            model.setI32_list(Arrays.asList(10, 20, 30));
            model.setS_list(Arrays.asList("a", "b", "c"));
            HashMap<String, Integer> map = new HashMap<>();
            map.put("key1", 100);
            map.put("key2", 200);
            model.setS_i32_map(map);

            NestedStruct nested = new NestedStruct();
            nested.setInner_val("nested_world");
            nested.setNumbers(Arrays.asList(1, 1, 2, 3, 5));
            model.setNested(nested);

            NestedStruct emptyNested = new NestedStruct();
            emptyNested.setInner_val("");
            emptyNested.setNumbers(new ArrayList<>());
            model.setEmpty_nested(emptyNested);

            NestedStruct nullNested = new NestedStruct();
            nullNested.setInner_val("inner");
            nullNested.setNumbers(new ArrayList<>());
            model.setNull_nested(nullNested);
            
            System.out.println("[Java] Initiated native model");
        } else {
            InputStream in = new FileInputStream(inputFile);
            DpProtocol iprot;
            if (protocol.equals("binary")) {
                iprot = new DpBinaryProtocol(in);
            } else if (protocol.equals("pack")) {
                iprot = new DpPackProtocol(in);
            } else if (protocol.equals("json")) {
                iprot = new DpJsonProtocol(in);
            } else {
                throw new RuntimeException("Unknown protocol: " + protocol);
            }

            model.read(iprot);
            in.close();

            System.out.println("[Java] Read model. s_val: " + model.getS_val());
        }

        OutputStream out = new FileOutputStream(outputFile);
        DpProtocol oprot;
        if (protocol.equals("binary")) {
            oprot = new DpBinaryProtocol(out);
        } else if (protocol.equals("pack")) {
            oprot = new DpPackProtocol(out);
        } else if (protocol.equals("json")) {
            oprot = new DpJsonProtocol(out);
        } else {
            throw new RuntimeException("Unknown protocol: " + protocol);
        }

        model.write(oprot);
        out.close();

        System.out.println("[Java] Successfully wrote " + outputFile);
    }
}
