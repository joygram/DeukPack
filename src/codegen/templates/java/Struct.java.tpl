package @@JAVA_PACKAGE@@;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * @@DOC_COMMENT@@
 * @generated
 */
@SuppressWarnings("serial")
public class @@STRUCT_NAME@@@@EXTENDS@@ implements IDeukPack, Serializable, Cloneable {
    private static final long serialVersionUID = 1L;

@@FIELD_DECLARATIONS@@

    public @@STRUCT_NAME@@() {
@@CONSTRUCTOR_INITIALIZATION@@
    }

@@GETTERS_SETTERS@@

    @Override
    public void write(DpProtocol oprot) {
        oprot.writeStructBegin(new DpRecord("@@STRUCT_NAME@@", @@NON_NULL_COUNT@@));
@@WRITE_BODY@@
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
@@NAME_TO_ID_LOGIC@@
            switch (id) {
@@READ_SWITCH_CASES@@
                default:
                    iprot.skip(field.Type);
                    break;
            }
            iprot.readFieldEnd();
        }
        iprot.readStructEnd();
        validate();
    }

    public @@STRUCT_NAME@@ readReturn(DpProtocol iprot) {
        this.read(iprot);
        return this;
    }

    public void validate() {
@@VALIDATE_BODY@@
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("@@STRUCT_NAME@@(");
@@TO_STRING_BODY@@
        sb.append(")");
        return sb.toString();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        @@STRUCT_NAME@@ that = (@@STRUCT_NAME@@) o;
        return @@EQUALS_BODY@@;
    }

    @Override
    public int hashCode() {
        return Objects.hash(@@HASH_CODE_BODY@@);
    }

    @Override
    public @@STRUCT_NAME@@ clone() {
        try {
            @@STRUCT_NAME@@ cloned = (@@STRUCT_NAME@@) super.clone();
@@CLONE_BODY@@
            return cloned;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
