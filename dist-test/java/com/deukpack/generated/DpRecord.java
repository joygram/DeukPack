package com.deukpack.generated;

public class DpRecord {
    public String Name = "";
    public int Count = 0;

    public DpRecord() {}
    public DpRecord(String name) { this.Name = name; }
    public DpRecord(String name, int count) { 
        this.Name = name; 
        this.Count = count;
    }
    
    public void read(DpProtocol iprot) {}
    public void write(DpProtocol oprot) {}
}
