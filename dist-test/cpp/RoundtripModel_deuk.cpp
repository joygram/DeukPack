#include "RoundtripModel_deuk.h"

namespace deuk {
namespace test {

void RoundtripModel::Write(DpProtocol& oprot) const {
  oprot.WriteStructBegin({"RoundtripModel", (b_val ? 1 : 0) + (i8_val ? 1 : 0) + (i16_val ? 1 : 0) + (i32_val ? 1 : 0) + (i64_val ? 1 : 0) + (f_val ? 1 : 0) + (d_val ? 1 : 0) + (s_val ? 1 : 0) + (bin_val ? 1 : 0) + (i32_list ? 1 : 0) + (s_list ? 1 : 0) + (s_i32_map ? 1 : 0) + (nested ? 1 : 0)});
    if (b_val) {
      oprot.WriteFieldBegin({"b_val", DpWireType::Bool, 1});
      oprot.WriteBool(*b_val);
      oprot.WriteFieldEnd();
    }
    if (i8_val) {
      oprot.WriteFieldBegin({"i8_val", DpWireType::Byte, 2});
      oprot.WriteByte(*i8_val);
      oprot.WriteFieldEnd();
    }
    if (i16_val) {
      oprot.WriteFieldBegin({"i16_val", DpWireType::Int16, 3});
      oprot.WriteI16(*i16_val);
      oprot.WriteFieldEnd();
    }
    if (i32_val) {
      oprot.WriteFieldBegin({"i32_val", DpWireType::Int32, 4});
      oprot.WriteI32(*i32_val);
      oprot.WriteFieldEnd();
    }
    if (i64_val) {
      oprot.WriteFieldBegin({"i64_val", DpWireType::Int64, 5});
      oprot.WriteI64(*i64_val);
      oprot.WriteFieldEnd();
    }
    if (f_val) {
      oprot.WriteFieldBegin({"f_val", DpWireType::Double, 6});
      oprot.WriteDouble(*f_val);
      oprot.WriteFieldEnd();
    }
    if (d_val) {
      oprot.WriteFieldBegin({"d_val", DpWireType::Double, 7});
      oprot.WriteDouble(*d_val);
      oprot.WriteFieldEnd();
    }
    if (s_val) {
      oprot.WriteFieldBegin({"s_val", DpWireType::String, 8});
      oprot.WriteString(*s_val);
      oprot.WriteFieldEnd();
    }
    if (bin_val) {
      oprot.WriteFieldBegin({"bin_val", DpWireType::String, 9});
      oprot.WriteBinary(*bin_val);
      oprot.WriteFieldEnd();
    }
    if (i32_list) {
      oprot.WriteFieldBegin({"i32_list", DpWireType::List, 10});
      oprot.WriteListBegin({DpWireType::Int32, static_cast<deuk::int32>(i32_list->size())});
      for (const auto& elem : *i32_list) {
        oprot.WriteI32(elem);
      }
      oprot.WriteListEnd();
      oprot.WriteFieldEnd();
    }
    if (s_list) {
      oprot.WriteFieldBegin({"s_list", DpWireType::List, 11});
      oprot.WriteListBegin({DpWireType::String, static_cast<deuk::int32>(s_list->size())});
      for (const auto& elem : *s_list) {
        oprot.WriteString(elem);
      }
      oprot.WriteListEnd();
      oprot.WriteFieldEnd();
    }
    if (s_i32_map) {
      oprot.WriteFieldBegin({"s_i32_map", DpWireType::Map, 12});
      oprot.WriteMapBegin({DpWireType::String, DpWireType::Int32, static_cast<deuk::int32>(s_i32_map->size())});
      for (const auto& kv : *s_i32_map) {
        oprot.WriteString(kv.first);
        oprot.WriteI32(kv.second);
      }
      oprot.WriteMapEnd();
      oprot.WriteFieldEnd();
    }
    if (nested) {
      oprot.WriteFieldBegin({"nested", DpWireType::Struct, 13});
      nested->Write(oprot);
      oprot.WriteFieldEnd();
    }
  oprot.WriteFieldStop();
  oprot.WriteStructEnd();
}

void RoundtripModel::Read(DpProtocol& iprot) {
  iprot.ReadStructBegin();
  while (true) {
    DpColumn field = iprot.ReadFieldBegin();
    if (field.Type == DpWireType::Stop) break;
    int16 id = field.ID;
    if (id == 0 && field.Name == "b_val") id = 1;
    if (id == 0 && field.Name == "i8_val") id = 2;
    if (id == 0 && field.Name == "i16_val") id = 3;
    if (id == 0 && field.Name == "i32_val") id = 4;
    if (id == 0 && field.Name == "i64_val") id = 5;
    if (id == 0 && field.Name == "f_val") id = 6;
    if (id == 0 && field.Name == "d_val") id = 7;
    if (id == 0 && field.Name == "s_val") id = 8;
    if (id == 0 && field.Name == "bin_val") id = 9;
    if (id == 0 && field.Name == "i32_list") id = 10;
    if (id == 0 && field.Name == "s_list") id = 11;
    if (id == 0 && field.Name == "s_i32_map") id = 12;
    if (id == 0 && field.Name == "nested") id = 13;
    switch (id) {
      case 1:
        if (field.Type == DpWireType::Bool || field.Type == DpWireType::Void) {
          b_val = std::make_shared<bool>(iprot.ReadBool());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 2:
        if (field.Type == DpWireType::Byte || field.Type == DpWireType::Void) {
          i8_val = std::make_shared<deuk::int8>(iprot.ReadByte());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 3:
        if (field.Type == DpWireType::Int16 || field.Type == DpWireType::Void) {
          i16_val = std::make_shared<deuk::int16>(iprot.ReadI16());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 4:
        if (field.Type == DpWireType::Int32 || field.Type == DpWireType::Void) {
          i32_val = std::make_shared<deuk::int32>(iprot.ReadI32());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 5:
        if (field.Type == DpWireType::Int64 || field.Type == DpWireType::Void) {
          i64_val = std::make_shared<deuk::int64>(iprot.ReadI64());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 6:
        if (field.Type == DpWireType::Double || field.Type == DpWireType::Void) {
          f_val = std::make_shared<deuk::float32>(static_cast<deuk::float32>(iprot.ReadDouble()));
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 7:
        if (field.Type == DpWireType::Double || field.Type == DpWireType::Void) {
          d_val = std::make_shared<deuk::float64>(iprot.ReadDouble());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 8:
        if (field.Type == DpWireType::String || field.Type == DpWireType::Void) {
          s_val = std::make_shared<std::string>(iprot.ReadString());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 9:
        if (field.Type == DpWireType::String || field.Type == DpWireType::Void) {
          bin_val = std::make_shared<std::string>(iprot.ReadBinary());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 10:
        if (field.Type == DpWireType::List || field.Type == DpWireType::Void) {
          i32_list = std::make_shared<std::vector<deuk::int32>>();
          auto info = iprot.ReadListBegin();
          for (int32 i = 0; i < info.Count; ++i) {
            i32_list->push_back(iprot.ReadI32());
          }
          iprot.ReadListEnd();
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 11:
        if (field.Type == DpWireType::List || field.Type == DpWireType::Void) {
          s_list = std::make_shared<std::vector<std::string>>();
          auto info = iprot.ReadListBegin();
          for (int32 i = 0; i < info.Count; ++i) {
            s_list->push_back(iprot.ReadString());
          }
          iprot.ReadListEnd();
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 12:
        if (field.Type == DpWireType::Map || field.Type == DpWireType::Void) {
          s_i32_map = std::make_shared<std::map<std::string, deuk::int32>>();
          auto info = iprot.ReadMapBegin();
          for (int32 i = 0; i < info.Count; ++i) {
            auto key = iprot.ReadString();
            auto val = iprot.ReadI32();
            (*s_i32_map)[key] = val;
          }
          iprot.ReadMapEnd();
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 13:
        if (field.Type == DpWireType::Struct || field.Type == DpWireType::Void) {
          nested = std::make_shared<NestedStruct>();
          nested->Read(iprot);
        } else {
          iprot.Skip(field.Type);
        }
        break;
      default: iprot.Skip(field.Type); break;
    }
    iprot.ReadFieldEnd();
  }
  iprot.ReadStructEnd();
}

void NestedStruct::Write(DpProtocol& oprot) const {
  oprot.WriteStructBegin({"NestedStruct", (inner_val ? 1 : 0) + (numbers ? 1 : 0)});
    if (inner_val) {
      oprot.WriteFieldBegin({"inner_val", DpWireType::String, 1});
      oprot.WriteString(*inner_val);
      oprot.WriteFieldEnd();
    }
    if (numbers) {
      oprot.WriteFieldBegin({"numbers", DpWireType::List, 2});
      oprot.WriteListBegin({DpWireType::Int32, static_cast<deuk::int32>(numbers->size())});
      for (const auto& elem : *numbers) {
        oprot.WriteI32(elem);
      }
      oprot.WriteListEnd();
      oprot.WriteFieldEnd();
    }
  oprot.WriteFieldStop();
  oprot.WriteStructEnd();
}

void NestedStruct::Read(DpProtocol& iprot) {
  iprot.ReadStructBegin();
  while (true) {
    DpColumn field = iprot.ReadFieldBegin();
    if (field.Type == DpWireType::Stop) break;
    int16 id = field.ID;
    if (id == 0 && field.Name == "inner_val") id = 1;
    if (id == 0 && field.Name == "numbers") id = 2;
    switch (id) {
      case 1:
        if (field.Type == DpWireType::String || field.Type == DpWireType::Void) {
          inner_val = std::make_shared<std::string>(iprot.ReadString());
        } else {
          iprot.Skip(field.Type);
        }
        break;
      case 2:
        if (field.Type == DpWireType::List || field.Type == DpWireType::Void) {
          numbers = std::make_shared<std::vector<deuk::int32>>();
          auto info = iprot.ReadListBegin();
          for (int32 i = 0; i < info.Count; ++i) {
            numbers->push_back(iprot.ReadI32());
          }
          iprot.ReadListEnd();
        } else {
          iprot.Skip(field.Type);
        }
        break;
      default: iprot.Skip(field.Type); break;
    }
    iprot.ReadFieldEnd();
  }
  iprot.ReadStructEnd();
}

void EnumModel::Write(DpProtocol& oprot) const {
  oprot.WriteStructBegin({"EnumModel", (e_val ? 1 : 0)});
    if (e_val) {
      oprot.WriteFieldBegin({"e_val", DpWireType::Int32, 1});
      oprot.WriteI32(static_cast<deuk::int32>(*e_val));
      oprot.WriteFieldEnd();
    }
  oprot.WriteFieldStop();
  oprot.WriteStructEnd();
}

void EnumModel::Read(DpProtocol& iprot) {
  iprot.ReadStructBegin();
  while (true) {
    DpColumn field = iprot.ReadFieldBegin();
    if (field.Type == DpWireType::Stop) break;
    int16 id = field.ID;
    if (id == 0 && field.Name == "e_val") id = 1;
    switch (id) {
      case 1:
        if (field.Type == DpWireType::Int32 || field.Type == DpWireType::Void) {
          e_val = std::make_shared<TestEnum>(static_cast<TestEnum>(iprot.ReadI32()));
        } else {
          iprot.Skip(field.Type);
        }
        break;
      default: iprot.Skip(field.Type); break;
    }
    iprot.ReadFieldEnd();
  }
  iprot.ReadStructEnd();
}

} // namespace test
} // namespace deuk
