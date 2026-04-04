import com.deukpack.generated.*;
import java.io.*;
import java.util.*;

public class JavaBridge {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) return;
        String protocol = args[0].toLowerCase();
        String inputFile = args[1];
        String outputFile = args[2];
        System.out.println("[Java] Protocol: " + protocol);

        boolean isComplex = inputFile.contains("ComplexRoundtripModel") || outputFile.contains("ComplexRoundtripModel");

        if (isComplex) {
            ComplexRoundtripModel model = new ComplexRoundtripModel();
            if (inputFile.equals("init")) {
                model.setB_val(false);
                model.setI8_val((byte)42);
                model.setI16_val((short)-1234);
                model.setI32_val(987654321);
                model.setI64_val(-9223372036854775806L);
                model.setF_val(-1.23f);
                model.setD_val(3.141592653589793);
                model.setS_val("Complex 안녕하세요 \uD83C\uDF0E \u0001 \n \t");
                model.setBin_val(new byte[]{0, (byte)255, 127, (byte)128, 42});
                model.setI8_neg((byte)-127);
                model.setI16_neg((short)-32767);
                model.setI32_neg(-2147483647);
                model.setI64_neg(-9223372036854775806L);
                model.setF_neg(-999.5f);
                model.setD_neg(-1234567890.123);
                model.setS_empty("");
                model.setBin_empty(new byte[0]);
                model.setI32_zero(0);
                model.setI32_list(Arrays.asList(0, 1, -1, 2147483647, -2147483647));
                model.setI64_list(Arrays.asList(0L, 1L, -1L, 9223372036854775806L, -9223372036854775806L));
                model.setS_list(Arrays.asList("", "alpha", "beta", "gamma \uD83D\uDE80"));
                model.setB_list(Arrays.asList(true, false, true, true));
                model.setD_list(Arrays.asList(0.0, -0.0, 1.5, -1.5));
                model.setI32_set(new LinkedHashSet<>(Arrays.asList(100, 200, 300)));
                model.setS_set(new LinkedHashSet<>(Arrays.asList("apple", "banana", "cherry")));
                
                HashMap<String, Integer> map1 = new HashMap<>();
                map1.put("", 0); map1.put("one", 1); map1.put("negative", -100);
                model.setS_i32_map(map1);
                
                HashMap<String, Double> map2 = new HashMap<>();
                map2.put("pi", 3.141592653589793); map2.put("e", 2.718281828459045);
                model.setS_d_map(map2);

                AddressStruct addr1 = new AddressStruct();
                addr1.setCity("Seoul"); addr1.setCountry("KR"); addr1.setZip_code(12345);
                model.setAddress(addr1);
                AddressStruct addr2 = new AddressStruct();
                addr2.setCity("New York"); addr2.setCountry("US"); addr2.setZip_code(10001);
                model.setAddress2(addr2);
                
                TagStruct t1 = new TagStruct(); t1.setKey("environment"); t1.setValue("production"); t1.setAliases(Arrays.asList("prod", "live"));
                model.setPrimary_tag(t1);

                TagStruct t2 = new TagStruct(); t2.setKey("tier"); t2.setValue("backend"); t2.setAliases(Arrays.asList("server"));
                TagStruct t3 = new TagStruct(); t3.setKey("region"); t3.setValue("ap-northeast-2"); t3.setAliases(Arrays.asList("seoul"));
                TagStruct t4 = new TagStruct(); t4.setKey("empty"); t4.setValue(""); t4.setAliases(new ArrayList<>());
                model.setTags(Arrays.asList(t2, t3, t4));
                
                HashMap<String, TagStruct> tMap = new HashMap<>();
                TagStruct m1 = new TagStruct(); m1.setKey("main_key"); m1.setValue("main_val"); m1.setAliases(Arrays.asList("m"));
                TagStruct m2 = new TagStruct(); m2.setKey("fb"); m2.setValue("fallback"); m2.setAliases(new ArrayList<>());
                tMap.put("main", m1); tMap.put("fallback", m2);
                model.setTag_lookup(tMap);

                model.setStatus(StatusEnum.Inactive);
                model.setOpt_null_str("not_null");
                model.setOpt_null_bin(new byte[]{(byte)255, (byte)255});
                model.setOpt_zero_i32(999);

            } else {
                InputStream in = new FileInputStream(inputFile);
                DpProtocol iprot = protocol.equals("binary") ? new DpBinaryProtocol(in) : (protocol.equals("pack") ? new DpPackProtocol(in) : new DpJsonProtocol(in));
                model.read(iprot);
                in.close();
            }

            OutputStream out = new FileOutputStream(outputFile);
            DpProtocol oprot = protocol.equals("binary") ? new DpBinaryProtocol(out) : (protocol.equals("pack") ? new DpPackProtocol(out) : new DpJsonProtocol(out));
            model.write(oprot);
            out.close();

        } else {
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
                HashMap<String, Integer> map = new HashMap<>(); map.put("key1", 100); map.put("key2", 200);
                model.setS_i32_map(map);
                NestedStruct nested = new NestedStruct(); nested.setInner_val("nested_world"); nested.setNumbers(Arrays.asList(1, 1, 2, 3, 5));
                model.setNested(nested);
                NestedStruct emptyNested = new NestedStruct(); emptyNested.setInner_val(""); emptyNested.setNumbers(new ArrayList<>());
                model.setEmpty_nested(emptyNested);
                NestedStruct nullNested = new NestedStruct(); nullNested.setInner_val("inner"); nullNested.setNumbers(new ArrayList<>());
                model.setNull_nested(nullNested);
            } else {
                InputStream in = new FileInputStream(inputFile);
                DpProtocol iprot = protocol.equals("binary") ? new DpBinaryProtocol(in) : (protocol.equals("pack") ? new DpPackProtocol(in) : new DpJsonProtocol(in));
                model.read(iprot);
                in.close();
            }
            OutputStream out = new FileOutputStream(outputFile);
            DpProtocol oprot = protocol.equals("binary") ? new DpBinaryProtocol(out) : (protocol.equals("pack") ? new DpPackProtocol(out) : new DpJsonProtocol(out));
            model.write(oprot);
            out.close();
        }
    }
}
