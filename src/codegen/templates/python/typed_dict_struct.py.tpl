
from .runtime import DpProtocol, DpWireType
from typing import List, Dict, Set, Optional, Any, TypedDict
import io
@@IMPORTS@@

class @@STRUCT_NAME@@(TypedDict, total=False):
    """
    @@DOC_COMMENT@@
    """
@@FIELD_DECLARATIONS@@

class @@STRUCT_NAME@@Codec:
    @staticmethod
    def pack(obj: '@@STRUCT_NAME@@', format: str = 'binary') -> bytes:
        if format != 'binary':
             raise NotImplementedError("Only binary format is supported in this version")
        buf = io.BytesIO()
        prot = DpProtocol.create('tbinary', buf)
        @@STRUCT_NAME@@Codec.serialize(obj, prot)
        return buf.getvalue()

    @staticmethod
    def serialize(obj: '@@STRUCT_NAME@@', prot: DpProtocol):
@@PACK_BODY@@
        prot.write_field_stop()

    @staticmethod
    def unpack(data: bytes, format: str = 'binary') -> '@@STRUCT_NAME@@':
        buf = io.BytesIO(data)
        prot = DpProtocol.create('tbinary', buf)
        return @@STRUCT_NAME@@Codec.deserialize(prot)

    @staticmethod
    def deserialize(prot: DpProtocol) -> '@@STRUCT_NAME@@':
        obj: '@@STRUCT_NAME@@' = {}
        while True:
            wire_type, field_id = prot.read_field_begin()
            if wire_type == DpWireType.STOP:
                break
@@UNPACK_BODY@@
            else:
                prot.skip(wire_type)
        return obj
