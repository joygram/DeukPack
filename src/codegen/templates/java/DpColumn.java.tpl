package @@JAVA_PACKAGE@@;

public class DpColumn {
    public String Name = "";
    public DpWireType Type = DpWireType.Stop;
    public short ID = 0;
    public DpColumn() {}
    public DpColumn(String name, DpWireType type, short id) {
        this.Name = name;
        this.Type = type;
        this.ID = id;
    }
}
