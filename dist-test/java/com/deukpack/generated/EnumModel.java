package com.deukpack.generated;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * Generated Struct: EnumModel
 * @generated
 */
public class EnumModel implements IDeukPack, Serializable, Cloneable {
    private static final long serialVersionUID = 1L;

    private TestEnum e_val;

    public EnumModel() {
        this.e_val = e_val;
    }

    public TestEnum getE_val() { return e_val; }
    public void setE_val(TestEnum e_val) { this.e_val = e_val; }

    @Override
    public void write(DpProtocol oprot) {
        oprot.writeStructBegin(new DpRecord("EnumModel", (this.e_val != null ? 1 : 0)));
        if (this.e_val != null) {
            oprot.writeFieldBegin(new DpColumn("e_val", DpWireType.Int32, (short)1));
            oprot.writeI32(this.e_val.getValue());
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
            if (id == 0 && "e_val".equals(field.Name)) id = 1;
            switch (id) {
                case 1:
                    if (field.Type == DpWireType.Int32 || field.Type == DpWireType.Void) {
                        this.e_val = TestEnum.findByValue(iprot.readI32());
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

    public EnumModel readReturn(DpProtocol iprot) {
        this.read(iprot);
        return this;
    }

    public void validate() {

    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("EnumModel(");
        sb.append("e_val:").append(this.e_val);
        sb.append(")");
        return sb.toString();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EnumModel that = (EnumModel) o;
        return Objects.equals(this.e_val, that.e_val);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.e_val);
    }

    @Override
    public EnumModel clone() {
        try {
            EnumModel cloned = (EnumModel) super.clone();

            return cloned;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
