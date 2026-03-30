package com.deukpack.generated;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * Generated Struct: NestedStruct
 * @generated
 */
public class NestedStruct implements IDeukPack, Serializable, Cloneable {
    private static final long serialVersionUID = 1L;

    private String inner_val = "inner";
    private List<Integer> numbers;

    public NestedStruct() {
        this.inner_val = inner_val;
        this.numbers = numbers;
    }

    public String getInner_val() { return inner_val; }
    public void setInner_val(String inner_val) { this.inner_val = inner_val; }

    public List<Integer> getNumbers() { return numbers; }
    public void setNumbers(List<Integer> numbers) { this.numbers = numbers; }

    @Override
    public void write(DpProtocol oprot) {
        oprot.writeStructBegin(new DpRecord("NestedStruct", (this.inner_val != null ? 1 : 0) + (this.numbers != null ? 1 : 0)));
        if (this.inner_val != null) {
            oprot.writeFieldBegin(new DpColumn("inner_val", DpWireType.String, (short)1));
            oprot.writeString(this.inner_val);
            oprot.writeFieldEnd();
        }
        if (this.numbers != null) {
            oprot.writeFieldBegin(new DpColumn("numbers", DpWireType.List, (short)2));
            oprot.writeListBegin(new DpList(DpWireType.Int32, this.numbers.size()));
            for (Integer _item : this.numbers) {
                oprot.writeI32(_item);
            }
            oprot.writeListEnd();
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
            if (id == 0 && "inner_val".equals(field.Name)) id = 1;
            if (id == 0 && "numbers".equals(field.Name)) id = 2;
            switch (id) {
                case 1:
                    if (field.Type == DpWireType.String || field.Type == DpWireType.Void) {
                        this.inner_val = iprot.readString();
                    } else {
                        iprot.skip(field.Type);
                    }
                    break;
                case 2:
                    if (field.Type == DpWireType.List || field.Type == DpWireType.Void) {
                        { DpList _list = iprot.readListBegin();
                        this.numbers = new ArrayList<>(_list.Count);
                        for (int _i = 0; _i < _list.Count; _i++) {
                            Integer _item = iprot.readI32();
                            this.numbers.add(_item);
                        }
                        iprot.readListEnd(); }
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

    public NestedStruct readReturn(DpProtocol iprot) {
        this.read(iprot);
        return this;
    }

    public void validate() {

    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("NestedStruct(");
        sb.append("inner_val:").append(this.inner_val);
        sb.append(", "); sb.append("numbers:").append(this.numbers);
        sb.append(")");
        return sb.toString();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        NestedStruct that = (NestedStruct) o;
        return Objects.equals(this.inner_val, that.inner_val) && Objects.equals(this.numbers, that.numbers);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.inner_val, this.numbers);
    }

    @Override
    public NestedStruct clone() {
        try {
            NestedStruct cloned = (NestedStruct) super.clone();
            if (this.numbers != null) cloned.numbers = new ArrayList<>(this.numbers);
            return cloned;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
