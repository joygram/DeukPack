package com.deukpack.generated;

public enum DpWireType {
    Stop(0),
    Void(1),
    Bool(2),
    Byte(3),
    Double(4),
    Int16(6),
    Int32(8),
    Int64(10),
    String(11),
    Struct(12),
    Map(13),
    Set(14),
    List(15),
    Binary(11);

    public final int value;
    DpWireType(int v) { this.value = v; }
    public int getValue() { return value; }
    public static DpWireType findByValue(int v) {
        for (DpWireType t : DpWireType.values()) {
            if (t.value == v) return t;
        }
        return Stop;
    }
}
