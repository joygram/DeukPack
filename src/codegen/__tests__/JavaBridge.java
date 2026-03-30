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

        RoundtripModel model = new RoundtripModel();
        model.read(iprot);
        in.close();

        System.out.println("[Java] Read model. s_val: " + model.getS_val());

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
