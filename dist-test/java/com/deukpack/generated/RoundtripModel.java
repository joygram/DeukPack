package com.deukpack.generated;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * Generated Struct: RoundtripModel
 * @generated
 */
public class RoundtripModel implements IDeukPack, Serializable, Cloneable {
    private static final long serialVersionUID = 1L;

    private Boolean b_val = true;
    private Byte i8_val = (byte) 8;
    private Short i16_val = (short) 1616;
    private Integer i32_val = 323232;
    private Long i64_val = 6464646464L;
    private Float f_val = 3.14f;
    private Double d_val = 2.71828d;
    private String s_val = "Hello DeukPack World";
    private byte[] bin_val;
    private List<Integer> i32_list;
    private List<String> s_list;
    private Map<String, Integer> s_i32_map;
    private NestedStruct nested;

    public RoundtripModel() {
        this.b_val = b_val;
        this.i8_val = i8_val;
        this.i16_val = i16_val;
        this.i32_val = i32_val;
        this.i64_val = i64_val;
        this.f_val = f_val;
        this.d_val = d_val;
        this.s_val = s_val;
        this.bin_val = bin_val;
        this.i32_list = i32_list;
        this.s_list = s_list;
        this.s_i32_map = s_i32_map;
        this.nested = nested;
    }

    public Boolean getB_val() { return b_val; }
    public void setB_val(Boolean b_val) { this.b_val = b_val; }

    public Byte getI8_val() { return i8_val; }
    public void setI8_val(Byte i8_val) { this.i8_val = i8_val; }

    public Short getI16_val() { return i16_val; }
    public void setI16_val(Short i16_val) { this.i16_val = i16_val; }

    public Integer getI32_val() { return i32_val; }
    public void setI32_val(Integer i32_val) { this.i32_val = i32_val; }

    public Long getI64_val() { return i64_val; }
    public void setI64_val(Long i64_val) { this.i64_val = i64_val; }

    public Float getF_val() { return f_val; }
    public void setF_val(Float f_val) { this.f_val = f_val; }

    public Double getD_val() { return d_val; }
    public void setD_val(Double d_val) { this.d_val = d_val; }

    public String getS_val() { return s_val; }
    public void setS_val(String s_val) { this.s_val = s_val; }

    public byte[] getBin_val() { return bin_val; }
    public void setBin_val(byte[] bin_val) { this.bin_val = bin_val; }

    public List<Integer> getI32_list() { return i32_list; }
    public void setI32_list(List<Integer> i32_list) { this.i32_list = i32_list; }

    public List<String> getS_list() { return s_list; }
    public void setS_list(List<String> s_list) { this.s_list = s_list; }

    public Map<String, Integer> getS_i32_map() { return s_i32_map; }
    public void setS_i32_map(Map<String, Integer> s_i32_map) { this.s_i32_map = s_i32_map; }

    public NestedStruct getNested() { return nested; }
    public void setNested(NestedStruct nested) { this.nested = nested; }

    @Override
    public void write(DpProtocol oprot) {
        oprot.writeStructBegin(new DpRecord("RoundtripModel", (this.b_val != null ? 1 : 0) + (this.i8_val != null ? 1 : 0) + (this.i16_val != null ? 1 : 0) + (this.i32_val != null ? 1 : 0) + (this.i64_val != null ? 1 : 0) + (this.f_val != null ? 1 : 0) + (this.d_val != null ? 1 : 0) + (this.s_val != null ? 1 : 0) + (this.bin_val != null ? 1 : 0) + (this.i32_list != null ? 1 : 0) + (this.s_list != null ? 1 : 0) + (this.s_i32_map != null ? 1 : 0) + (this.nested != null ? 1 : 0)));
        if (this.b_val != null) {
            oprot.writeFieldBegin(new DpColumn("b_val", DpWireType.Bool, (short)1));
            oprot.writeBool(this.b_val);
            oprot.writeFieldEnd();
        }
        if (this.i8_val != null) {
            oprot.writeFieldBegin(new DpColumn("i8_val", DpWireType.Byte, (short)2));
            oprot.writeByte(this.i8_val);
            oprot.writeFieldEnd();
        }
        if (this.i16_val != null) {
            oprot.writeFieldBegin(new DpColumn("i16_val", DpWireType.Int16, (short)3));
            oprot.writeI16(this.i16_val);
            oprot.writeFieldEnd();
        }
        if (this.i32_val != null) {
            oprot.writeFieldBegin(new DpColumn("i32_val", DpWireType.Int32, (short)4));
            oprot.writeI32(this.i32_val);
            oprot.writeFieldEnd();
        }
        if (this.i64_val != null) {
            oprot.writeFieldBegin(new DpColumn("i64_val", DpWireType.Int64, (short)5));
            oprot.writeI64(this.i64_val);
            oprot.writeFieldEnd();
        }
        if (this.f_val != null) {
            oprot.writeFieldBegin(new DpColumn("f_val", DpWireType.Double, (short)6));
            oprot.writeDouble(this.f_val);
            oprot.writeFieldEnd();
        }
        if (this.d_val != null) {
            oprot.writeFieldBegin(new DpColumn("d_val", DpWireType.Double, (short)7));
            oprot.writeDouble(this.d_val);
            oprot.writeFieldEnd();
        }
        if (this.s_val != null) {
            oprot.writeFieldBegin(new DpColumn("s_val", DpWireType.String, (short)8));
            oprot.writeString(this.s_val);
            oprot.writeFieldEnd();
        }
        if (this.bin_val != null) {
            oprot.writeFieldBegin(new DpColumn("bin_val", DpWireType.String, (short)9));
            oprot.writeBinary(this.bin_val);
            oprot.writeFieldEnd();
        }
        if (this.i32_list != null) {
            oprot.writeFieldBegin(new DpColumn("i32_list", DpWireType.List, (short)10));
            oprot.writeListBegin(new DpList(DpWireType.Int32, this.i32_list.size()));
            for (Integer _item : this.i32_list) {
                oprot.writeI32(_item);
            }
            oprot.writeListEnd();
            oprot.writeFieldEnd();
        }
        if (this.s_list != null) {
            oprot.writeFieldBegin(new DpColumn("s_list", DpWireType.List, (short)11));
            oprot.writeListBegin(new DpList(DpWireType.String, this.s_list.size()));
            for (String _item : this.s_list) {
                oprot.writeString(_item);
            }
            oprot.writeListEnd();
            oprot.writeFieldEnd();
        }
        if (this.s_i32_map != null) {
            oprot.writeFieldBegin(new DpColumn("s_i32_map", DpWireType.Map, (short)12));
            oprot.writeMapBegin(new DpDict(DpWireType.String, DpWireType.Int32, this.s_i32_map.size()));
            for (Map.Entry<String, Integer> _entry : this.s_i32_map.entrySet()) {
                oprot.writeString(_entry.getKey());
                oprot.writeI32(_entry.getValue());
            }
            oprot.writeMapEnd();
            oprot.writeFieldEnd();
        }
        if (this.nested != null) {
            oprot.writeFieldBegin(new DpColumn("nested", DpWireType.Struct, (short)13));
            this.nested.write(oprot);
            oprot.writeFieldEnd();
        }
        oprot.writeFieldStop();
        oprot.writeStructEnd();
    }

    @Override
    public void read(DpProtocol iprot) {
        iprot.readStructBegin();
        while (true) {
            DpColumn field = iprot.readFieldBegin();
            if (field.Type == DpWireType.Stop) {
                break;
            }
            int id = field.ID;
            if (id == 0 && "b_val".equals(field.Name)) id = 1;
            if (id == 0 && "i8_val".equals(field.Name)) id = 2;
            if (id == 0 && "i16_val".equals(field.Name)) id = 3;
            if (id == 0 && "i32_val".equals(field.Name)) id = 4;
            if (id == 0 && "i64_val".equals(field.Name)) id = 5;
            if (id == 0 && "f_val".equals(field.Name)) id = 6;
            if (id == 0 && "d_val".equals(field.Name)) id = 7;
            if (id == 0 && "s_val".equals(field.Name)) id = 8;
            if (id == 0 && "bin_val".equals(field.Name)) id = 9;
            if (id == 0 && "i32_list".equals(field.Name)) id = 10;
            if (id == 0 && "s_list".equals(field.Name)) id = 11;
            if (id == 0 && "s_i32_map".equals(field.Name)) id = 12;
            if (id == 0 && "nested".equals(field.Name)) id = 13;
            switch (id) {
                case 1:
                    if (field.Type == DpWireType.Bool || field.Type == DpWireType.Void) {
                        this.b_val = iprot.readBool();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 2:
                    if (field.Type == DpWireType.Byte || field.Type == DpWireType.Void) {
                        this.i8_val = iprot.readByte();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 3:
                    if (field.Type == DpWireType.Int16 || field.Type == DpWireType.Void) {
                        this.i16_val = iprot.readI16();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 4:
                    if (field.Type == DpWireType.Int32 || field.Type == DpWireType.Void) {
                        this.i32_val = iprot.readI32();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 5:
                    if (field.Type == DpWireType.Int64 || field.Type == DpWireType.Void) {
                        this.i64_val = iprot.readI64();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 6:
                    if (field.Type == DpWireType.Double || field.Type == DpWireType.Void) {
                        this.f_val = (float) iprot.readDouble();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 7:
                    if (field.Type == DpWireType.Double || field.Type == DpWireType.Void) {
                        this.d_val = iprot.readDouble();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 8:
                    if (field.Type == DpWireType.String || field.Type == DpWireType.Void) {
                        this.s_val = iprot.readString();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 9:
                    if (field.Type == DpWireType.String || field.Type == DpWireType.Void) {
                        this.bin_val = iprot.readBinary();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 10:
                    if (field.Type == DpWireType.List || field.Type == DpWireType.Void) {
                        { DpList _list = iprot.readListBegin();
                        this.i32_list = new ArrayList<>(_list.Count);
                        for (int _i = 0; _i < _list.Count; _i++) {
                            Integer _item = iprot.readI32();
                            this.i32_list.add(_item);
                        }
                        iprot.readListEnd(); }
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 11:
                    if (field.Type == DpWireType.List || field.Type == DpWireType.Void) {
                        { DpList _list = iprot.readListBegin();
                        this.s_list = new ArrayList<>(_list.Count);
                        for (int _i = 0; _i < _list.Count; _i++) {
                            String _item = iprot.readString();
                            this.s_list.add(_item);
                        }
                        iprot.readListEnd(); }
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 12:
                    if (field.Type == DpWireType.Map || field.Type == DpWireType.Void) {
                        { DpDict _dict = iprot.readMapBegin();
                        this.s_i32_map = new HashMap<>(_dict.Count);
                        for (int _i = 0; _i < _dict.Count; _i++) {
                            String _key = iprot.readString();
                            Integer _val = iprot.readI32();
                            this.s_i32_map.put(_key, _val);
                        }
                        iprot.readMapEnd(); }
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 13:
                    if (field.Type == DpWireType.Struct || field.Type == DpWireType.Void) {
                        this.nested = new NestedStruct();
                        this.nested.read(iprot);
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                default:
                    iprot.skip(field.Type);
                    break;
            }
            iprot.readFieldEnd();
        }
        iprot.readStructEnd();
        validate();
    }

    public RoundtripModel readReturn(DpProtocol iprot) {
        this.read(iprot);
        return this;
    }

    public void validate() {

    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("RoundtripModel(");
        sb.append("b_val:").append(this.b_val);
        sb.append(", "); sb.append("i8_val:").append(this.i8_val);
        sb.append(", "); sb.append("i16_val:").append(this.i16_val);
        sb.append(", "); sb.append("i32_val:").append(this.i32_val);
        sb.append(", "); sb.append("i64_val:").append(this.i64_val);
        sb.append(", "); sb.append("f_val:").append(this.f_val);
        sb.append(", "); sb.append("d_val:").append(this.d_val);
        sb.append(", "); sb.append("s_val:").append(this.s_val);
        sb.append(", "); sb.append("bin_val:").append(this.bin_val);
        sb.append(", "); sb.append("i32_list:").append(this.i32_list);
        sb.append(", "); sb.append("s_list:").append(this.s_list);
        sb.append(", "); sb.append("s_i32_map:").append(this.s_i32_map);
        sb.append(", "); sb.append("nested:").append(this.nested);
        sb.append(")");
        return sb.toString();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RoundtripModel that = (RoundtripModel) o;
        return Objects.equals(this.b_val, that.b_val) && Objects.equals(this.i8_val, that.i8_val) && Objects.equals(this.i16_val, that.i16_val) && Objects.equals(this.i32_val, that.i32_val) && Objects.equals(this.i64_val, that.i64_val) && Objects.equals(this.f_val, that.f_val) && Objects.equals(this.d_val, that.d_val) && Objects.equals(this.s_val, that.s_val) && Objects.equals(this.bin_val, that.bin_val) && Objects.equals(this.i32_list, that.i32_list) && Objects.equals(this.s_list, that.s_list) && Objects.equals(this.s_i32_map, that.s_i32_map) && Objects.equals(this.nested, that.nested);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.b_val, this.i8_val, this.i16_val, this.i32_val, this.i64_val, this.f_val, this.d_val, this.s_val, this.bin_val, this.i32_list, this.s_list, this.s_i32_map, this.nested);
    }

    @Override
    public RoundtripModel clone() {
        try {
            RoundtripModel cloned = (RoundtripModel) super.clone();
            if (this.i32_list != null) cloned.i32_list = new ArrayList<>(this.i32_list);
            if (this.s_list != null) cloned.s_list = new ArrayList<>(this.s_list);
            if (this.s_i32_map != null) cloned.s_i32_map = new HashMap<>(this.s_i32_map);
            return cloned;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
