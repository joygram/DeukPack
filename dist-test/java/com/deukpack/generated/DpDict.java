package com.deukpack.generated;

public class DpDict {
    public DpWireType KeyType = DpWireType.Stop;
    public DpWireType ValueType = DpWireType.Stop;
    public int Count = 0;
    public DpDict() {}
    public DpDict(DpWireType keyType, DpWireType valueType, int count) {
        this.KeyType = keyType;
        this.ValueType = valueType;
        this.Count = count;
    }
}
