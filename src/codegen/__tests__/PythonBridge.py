import sys
import io
import os

# Add dist-test/python to sys.path so we can import the generated modules
sys.path.append(os.path.abspath("dist-test/python"))

from deukpack_generated.complex_roundtrip_model import ComplexRoundtripModel
from deukpack_generated.roundtrip_model import RoundtripModel
from deukpack_generated.address_struct import AddressStruct
from deukpack_generated.tag_struct import TagStruct
from deukpack_generated.status_enum import StatusEnum
from deukpack_generated.nested_struct import NestedStruct
from deukpack_generated.runtime import DpProtocol

def init_complex_model() -> ComplexRoundtripModel:
    model = ComplexRoundtripModel()
    model.b_val = False
    model.i8_val = 42
    model.i16_val = -1234
    model.i32_val = 987654321
    model.i64_val = -9223372036854775806
    model.f_val = -1.23
    model.d_val = 3.141592653589793
    model.s_val = "Complex 안녕하세요 \U0001F30E \x01 \n \t"
    model.bin_val = bytes([0, 255, 127, 128, 42])
    
    model.i8_neg = -127
    model.i16_neg = -32767
    model.i32_neg = -2147483647
    model.i64_neg = -9223372036854775806
    model.f_neg = -999.5
    model.d_neg = -1234567890.123
    
    model.s_empty = ""
    model.bin_empty = b""
    model.i32_zero = 0
    
    model.i32_list = [0, 1, -1, 2147483647, -2147483647]
    model.i64_list = [0, 1, -1, 9223372036854775806, -9223372036854775806]
    model.s_list = ["", "alpha", "beta", "gamma \U0001F680"]
    model.b_list = [True, False, True, True]
    model.d_list = [0.0, -0.0, 1.5, -1.5]
    
    model.i32_set = dict.fromkeys([100, 200, 300]).keys()
    model.s_set = dict.fromkeys(["apple", "banana", "cherry"]).keys()
    
    model.s_i32_map = {"": 0, "one": 1, "negative": -100}
    model.s_d_map = {"pi": 3.141592653589793, "e": 2.718281828459045}
    
    addr1 = AddressStruct()
    addr1.city = "Seoul"
    addr1.country = "KR"
    addr1.zip_code = 12345
    model.address = addr1
    
    addr2 = AddressStruct()
    addr2.city = "New York"
    addr2.country = "US"
    addr2.zip_code = 10001
    model.address2 = addr2
    
    t1 = TagStruct()
    t1.key = "environment"
    t1.value = "production"
    t1.aliases = ["prod", "live"]
    model.primary_tag = t1
    
    t2 = TagStruct()
    t2.key = "tier"
    t2.value = "backend"
    t2.aliases = ["server"]
    
    t3 = TagStruct()
    t3.key = "region"
    t3.value = "ap-northeast-2"
    t3.aliases = ["seoul"]
    
    t4 = TagStruct()
    t4.key = "empty"
    t4.value = ""
    t4.aliases = []
    model.tags = [t2, t3, t4]
    
    m1 = TagStruct()
    m1.key = "main_key"
    m1.value = "main_val"
    m1.aliases = ["m"]
    
    m2 = TagStruct()
    m2.key = "fb"
    m2.value = "fallback"
    m2.aliases = []
    
    model.tag_lookup = {"main": m1, "fallback": m2}
    
    model.status = StatusEnum.Inactive
    model.opt_null_str = "not_null"
    model.opt_null_bin = bytes([255, 255])
    model.opt_zero_i32 = 999
    
    return model

def init_roundtrip_model() -> RoundtripModel:
    model = RoundtripModel()
    model.b_val = True
    model.i8_val = 123
    model.i16_val = 1234
    model.i32_val = 123456
    model.i64_val = 1234567890123456789
    model.f_val = 3.140000104904175
    model.d_val = 2.718281828459
    model.s_val = "DeukPack Shared World"
    model.bin_val = bytes([1, 2, 3, 4])
    model.i32_list = [10, 20, 30]
    model.s_list = ["a", "b", "c"]
    model.s_i32_map = {"key1": 100, "key2": 200}
    
    nested = NestedStruct()
    nested.inner_val = "nested_world"
    nested.numbers = [1, 1, 2, 3, 5]
    model.nested = nested
    
    empty_nested = NestedStruct()
    empty_nested.inner_val = ""
    empty_nested.numbers = []
    model.empty_nested = empty_nested
    
    null_nested = NestedStruct()
    null_nested.inner_val = "inner"
    null_nested.numbers = []
    model.null_nested = null_nested
    
    return model

def get_protocol(prot_name: str, buf: io.BytesIO = None) -> DpProtocol:
    if prot_name == "binary":
        return DpProtocol.create("tbinary", buffer=buf)
    elif prot_name == "pack":
        return DpProtocol.create("pack", buffer=buf)
    elif prot_name == "json":
        return DpProtocol.create("json", buffer=buf)
    else:
        raise ValueError(f"Unknown protocol {prot_name}")

def main():
    if len(sys.argv) < 4:
        print("Usage: PythonBridge.py <protocol> <inputFile> <outputFile>")
        return
        
    protocol = sys.argv[1].lower()
    input_file = sys.argv[2]
    output_file = sys.argv[3]
    
    print(f"[Python] Protocol: {protocol}")
    
    is_complex = "ComplexRoundtripModel" in input_file or "ComplexRoundtripModel" in output_file
    
    model = None
    
    if is_complex:
        model = ComplexRoundtripModel()
        if input_file == "init":
            model = init_complex_model()
        else:
            with open(input_file, "rb") as f:
                data = f.read()
            if protocol == "json":
                prot = DpProtocol.from_bytes(data)
                model.deserialize(prot)
            else:
                buf = io.BytesIO(data)
                prot = get_protocol(protocol, buf)
                model.deserialize(prot)
    else:
        model = RoundtripModel()
        if input_file == "init":
            model = init_roundtrip_model()
        else:
            with open(input_file, "rb") as f:
                data = f.read()
            if protocol == "json":
                from deukpack_generated.runtime import JsonProtocol
                prot = JsonProtocol.from_bytes(data)
                model.deserialize(prot)
            else:
                buf = io.BytesIO(data)
                prot = get_protocol(protocol, buf)
                model.deserialize(prot)
                
    if protocol == "json":
        prot = get_protocol(protocol)
        model.serialize(prot)
        with open(output_file, "wb") as f:
            f.write(prot.get_value())
    else:
        buf = io.BytesIO()
        prot = get_protocol(protocol, buf)
        model.serialize(prot)
        with open(output_file, "wb") as f:
            f.write(buf.getvalue())

if __name__ == "__main__":
    main()
