package @@JAVA_PACKAGE@@;

public class DpMessage {
    public String Name = "";
    public byte Type = 0;
    public int SeqID = 0;
    public DpMessage() {}
    public DpMessage(String name, byte type, int seqID) {
        this.Name = name;
        this.Type = type;
        this.SeqID = seqID;
    }
}
