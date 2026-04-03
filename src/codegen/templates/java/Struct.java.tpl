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

    // Unified DeukPack Serialization API

    public byte[] pack() { return pack("binary"); }
    public byte[] pack(String format) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            if ("json".equals(format)) {
                DpJsonProtocol prot = new DpJsonProtocol(baos);
                this.write(prot);
            } else {
                DpBinaryProtocol prot = new DpBinaryProtocol(baos);
                this.write(prot);
            }
            return baos.toByteArray();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    public static byte[] pack(@@STRUCT_NAME@@ obj) { return obj.pack("binary"); }
    public static byte[] pack(@@STRUCT_NAME@@ obj, String format) { return obj.pack(format); }

    /**
     * Deserializes data into a NEW instance of @@STRUCT_NAME@@.
     * [CAUTION] Avoid using this in high-frequency network loops as it allocates memory and triggers GC pauses.
     */
    public static @@STRUCT_NAME@@ unpack(byte[] buf) { return unpack(buf, "binary"); }
    public static @@STRUCT_NAME@@ unpack(byte[] buf, String format) {
        @@STRUCT_NAME@@ obj = new @@STRUCT_NAME@@();
        unpack(obj, buf, format);
        return obj;
    }

    /**
     * Deserializes data into an EXISTING instance of @@STRUCT_NAME@@. (Zero-Allocation)
     * Use this in high-frequency network hotpaths to overwrite pooled objects and prevent GC spikes.
     */
    public static void unpack(@@STRUCT_NAME@@ obj, byte[] buf) { unpack(obj, buf, "binary"); }
    public static void unpack(@@STRUCT_NAME@@ obj, byte[] buf, String format) {

        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(buf);
            if ("json".equals(format)) {
                DpJsonProtocol prot = new DpJsonProtocol(bais);
                obj.read(prot);
            } else {
                DpBinaryProtocol prot = new DpBinaryProtocol(bais);
                obj.read(prot);
            }
        } catch (Exception e) { throw new RuntimeException(e); }
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
