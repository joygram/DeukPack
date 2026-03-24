/**
 * DeukPack protocol utility (Skip 등). DpProtocolLibrary 모듈화.
 */

using System;

namespace DeukPack.Protocol
{
    public static class DpProtocolUtil
    {
        public static void Skip(DpProtocol prot, DpWireType type)
        {
            switch (type)
            {
                case DpWireType.Bool: prot.ReadBool(); break;
                case DpWireType.Byte: prot.ReadByte(); break;
                case DpWireType.Int16: prot.ReadI16(); break;
                case DpWireType.Int32: prot.ReadI32(); break;
                case DpWireType.Int64: prot.ReadI64(); break;
                case DpWireType.Double: prot.ReadDouble(); break;
                case DpWireType.String: prot.ReadBinary(); break;
                case DpWireType.List:
                    var list = prot.ReadListBegin();
                    for (int i = 0; i < list.Count; i++) Skip(prot, list.ElementType);
                    prot.ReadListEnd();
                    break;
                case DpWireType.Set:
                    var set = prot.ReadSetBegin();
                    for (int i = 0; i < set.Count; i++) Skip(prot, set.ElementType);
                    prot.ReadSetEnd();
                    break;
                case DpWireType.Map:
                    var map = prot.ReadMapBegin();
                    for (int i = 0; i < map.Count; i++) { Skip(prot, map.KeyType); Skip(prot, map.ValueType); }
                    prot.ReadMapEnd();
                    break;
                case DpWireType.Struct:
                    prot.ReadStructBegin();
                    while (true)
                    {
                        var field = prot.ReadFieldBegin();
                        if (field.Type == DpWireType.Stop) break;
                        Skip(prot, field.Type);
                        prot.ReadFieldEnd();
                    }
                    prot.ReadStructEnd();
                    break;
            }
        }
    }
}
