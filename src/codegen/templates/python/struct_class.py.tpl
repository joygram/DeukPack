
from .runtime import DpProtocol, DpWireType
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Any
import io
@@IMPORTS@@


@@DATACLASS_DECORATOR@@
class @@STRUCT_NAME@@:
    """
    @@DOC_COMMENT@@
    """
@@FIELD_DECLARATIONS@@

    def pack(self, format: str = 'binary') -> bytes:
        if format != 'binary':
             raise NotImplementedError("Only binary format is supported in this version")
        buf = io.BytesIO()
        prot = DpProtocol.create('tbinary', buf)
        self.serialize(prot)
        return buf.getvalue()

    def serialize(self, prot: DpProtocol):
@@PACK_BODY@@
        prot.write_field_stop()

    @staticmethod
    def unpack(data: bytes, format: str = 'binary') -> '@@STRUCT_NAME@@':
        buf = io.BytesIO(data)
        prot = DpProtocol.create('tbinary', buf)
        obj = @@STRUCT_NAME@@()
        obj.deserialize(prot)
        return obj

    def deserialize(self, prot: DpProtocol):
        while True:
            wire_type, field_id = prot.read_field_begin()
            if wire_type == DpWireType.STOP:
                break
@@UNPACK_BODY@@
            else:
                prot.skip(wire_type)
