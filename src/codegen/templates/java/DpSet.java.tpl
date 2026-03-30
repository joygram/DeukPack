package @@JAVA_PACKAGE@@;

public class DpSet {
    public DpWireType ElementType = DpWireType.Stop;
    public int Count = 0;
    public DpSet() {}
    public DpSet(DpWireType elementType, int count) {
        this.ElementType = elementType;
        this.Count = count;
    }
}
