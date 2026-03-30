package @@JAVA_PACKAGE@@;

public class DpList {
    public DpWireType ElementType = DpWireType.Stop;
    public int Count = 0;
    public DpList() {}
    public DpList(DpWireType elementType, int count) {
        this.ElementType = elementType;
        this.Count = count;
    }
}
