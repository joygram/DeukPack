"""
DeukPack Python Runtime — All Protocols
Implements TBinary, TCompact, Pack (DeukPack native), Protobuf, JSON

Protocol compatibility matrix:
  tbinary  : Thrift TBinaryProtocol (Apache Thrift wire-compatible, BE by default)
  tcompact : Thrift TCompactProtocol (varint, smaller payload)
  pack     : DeukPack native (.dpk) — TCompact + 3-byte magic header [0x44, 0x50, 0x01]
  protobuf : Google Protobuf binary wire format v2/v3
  json     : JSON serialization (field_id-keyed or field_name-keyed)
"""

import struct
import io
import json as _json
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_SAFE_LENGTH   = 10 * 1024 * 1024  # 10 MB
MAX_ELEMENT_COUNT = 1_000_000
MAX_RECURSION_DEPTH = 64

DP_PACK_MAGIC = bytes([0x44, 0x50, 0x01])  # "DP\x01"


class DpWireType:
    STOP    = 0
    BOOL    = 2
    BYTE    = 3
    DOUBLE  = 4
    INT16   = 6
    INT32   = 8
    INT64   = 10
    STRING  = 11
    STRUCT  = 12
    MAP     = 13
    SET     = 14
    LIST    = 15


class DpProtocolError(Exception):
    pass


# ---------------------------------------------------------------------------
# Base class / typing helper
# ---------------------------------------------------------------------------

class DpProtocolBase:
    """Shared safety helpers used by all protocol implementations."""

    _MAX_SAFE_LENGTH     = MAX_SAFE_LENGTH
    _MAX_ELEMENT_COUNT   = MAX_ELEMENT_COUNT
    _MAX_RECURSION_DEPTH = MAX_RECURSION_DEPTH

    def _check_length(self, length: int, name: str = "data") -> None:
        if length < 0:
            raise DpProtocolError(f"negative length for {name}")
        if length > self._MAX_SAFE_LENGTH:
            raise DpProtocolError(
                f"{name} length {length} exceeds MAX_SAFE_LENGTH ({self._MAX_SAFE_LENGTH})"
            )

    def _check_count(self, count: int, name: str = "element") -> None:
        if count < 0:
            raise DpProtocolError(f"negative count for {name}")
        if count > self._MAX_ELEMENT_COUNT:
            raise DpProtocolError(
                f"{name} count {count} exceeds MAX_ELEMENT_COUNT ({self._MAX_ELEMENT_COUNT})"
            )

    def _check_depth(self, depth: int) -> None:
        if depth > self._MAX_RECURSION_DEPTH:
            raise DpProtocolError(f"exceeded maximum recursion depth ({self._MAX_RECURSION_DEPTH})")

# ===========================================================================
# 1. TBinary Protocol  (Thrift TBinaryProtocol compatible)
#    type(1B) + field_id(2B, BE) + value
# ===========================================================================

class DpTBinaryProtocol(DpProtocolBase):
    """
    Apache Thrift TBinaryProtocol compatible.
    Big-endian by default (set little_endian=True for LE variant).
    """

    _BOOL_FMT   = ">B"
    _BYTE_FMT   = ">b"
    _I16_FMT    = ">h"
    _I32_FMT    = ">i"
    _I64_FMT    = ">q"
    _DOUBLE_FMT = ">d"
    _U32_FMT    = ">I"

    def __init__(self, buffer: Optional[io.BytesIO] = None, little_endian: bool = False):
        self.buf = buffer or io.BytesIO()
        e = "<" if little_endian else ">"
        self._bool_s   = struct.Struct(f"{e}B")
        self._byte_s   = struct.Struct(f"{e}b")
        self._i16_s    = struct.Struct(f"{e}h")
        self._i32_s    = struct.Struct(f"{e}i")
        self._i64_s    = struct.Struct(f"{e}q")
        self._double_s = struct.Struct(f"{e}d")
        self._u32_s    = struct.Struct(f"{e}I")

    # ── Write ──────────────────────────────────────────────────────────────

    def write_field_begin(self, wire_type: int, field_id: int) -> None:
        self.buf.write(self._bool_s.pack(wire_type))
        self.buf.write(self._i16_s.pack(field_id))

    def write_field_stop(self) -> None:
        self.buf.write(self._bool_s.pack(DpWireType.STOP))

    def write_bool(self, v: bool) -> None:
        self.buf.write(self._bool_s.pack(1 if v else 0))

    def write_byte(self, v: int) -> None:
        self.buf.write(self._byte_s.pack(v))

    def write_int16(self, v: int) -> None:
        self.buf.write(self._i16_s.pack(v))

    def write_int32(self, v: int) -> None:
        self.buf.write(self._i32_s.pack(v))

    def write_int64(self, v: int) -> None:
        self.buf.write(self._i64_s.pack(v))

    def write_double(self, v: float) -> None:
        self.buf.write(self._double_s.pack(v))

    def write_string(self, v: str) -> None:
        enc = v.encode("utf-8")
        self._check_length(len(enc), "string")
        self.buf.write(self._u32_s.pack(len(enc)))
        self.buf.write(enc)

    def write_binary(self, v: bytes) -> None:
        self._check_length(len(v), "binary")
        self.buf.write(self._u32_s.pack(len(v)))
        self.buf.write(v)

    def write_list_begin(self, element_type: int, count: int) -> None:
        self._check_count(count, "list")
        self.buf.write(self._bool_s.pack(element_type))
        self.buf.write(self._i32_s.pack(count))

    def write_set_begin(self, element_type: int, count: int) -> None:
        self.write_list_begin(element_type, count)

    def write_map_begin(self, key_type: int, value_type: int, count: int) -> None:
        self._check_count(count, "map")
        self.buf.write(self._bool_s.pack(key_type))
        self.buf.write(self._bool_s.pack(value_type))
        self.buf.write(self._i32_s.pack(count))

    # ── Read ───────────────────────────────────────────────────────────────

    def read_field_begin(self) -> Tuple[int, int]:
        raw = self.buf.read(1)
        if not raw:
            return DpWireType.STOP, 0
        wt = self._bool_s.unpack(raw)[0]
        if wt == DpWireType.STOP:
            return wt, 0
        fid = self._i16_s.unpack(self.buf.read(2))[0]
        return wt, fid

    def read_bool(self) -> bool:
        return self._bool_s.unpack(self.buf.read(1))[0] != 0

    def read_byte(self) -> int:
        return self._byte_s.unpack(self.buf.read(1))[0]

    def read_int16(self) -> int:
        return self._i16_s.unpack(self.buf.read(2))[0]

    def read_int32(self) -> int:
        return self._i32_s.unpack(self.buf.read(4))[0]

    def read_int64(self) -> int:
        return self._i64_s.unpack(self.buf.read(8))[0]

    def read_double(self) -> float:
        return self._double_s.unpack(self.buf.read(8))[0]

    def read_string(self) -> str:
        length = self._u32_s.unpack(self.buf.read(4))[0]
        self._check_length(length, "string")
        return self.buf.read(length).decode("utf-8")

    def read_binary(self) -> bytes:
        length = self._u32_s.unpack(self.buf.read(4))[0]
        self._check_length(length, "binary")
        return self.buf.read(length)

    def read_list_begin(self) -> Tuple[int, int]:
        et = self._bool_s.unpack(self.buf.read(1))[0]
        count = self._i32_s.unpack(self.buf.read(4))[0]
        self._check_count(count, "list")
        return et, count

    def read_set_begin(self) -> Tuple[int, int]:
        return self.read_list_begin()

    def read_map_begin(self) -> Tuple[int, int, int]:
        kt = self._bool_s.unpack(self.buf.read(1))[0]
        vt = self._bool_s.unpack(self.buf.read(1))[0]
        count = self._i32_s.unpack(self.buf.read(4))[0]
        self._check_count(count, "map")
        return kt, vt, count

    def skip(self, wire_type: int, depth: int = 0) -> None:
        self._check_depth(depth)
        if wire_type in (DpWireType.BOOL, DpWireType.BYTE):
            self.buf.read(1)
        elif wire_type == DpWireType.INT16:
            self.buf.read(2)
        elif wire_type == DpWireType.INT32:
            self.buf.read(4)
        elif wire_type in (DpWireType.INT64, DpWireType.DOUBLE):
            self.buf.read(8)
        elif wire_type == DpWireType.STRING:
            length = self._u32_s.unpack(self.buf.read(4))[0]
            self._check_length(length, "skip_string")
            self.buf.read(length)
        elif wire_type == DpWireType.STRUCT:
            while True:
                wt, _ = self.read_field_begin()
                if wt == DpWireType.STOP:
                    break
                self.skip(wt, depth + 1)
        elif wire_type in (DpWireType.LIST, DpWireType.SET):
            et, count = self.read_list_begin()
            for _ in range(count):
                self.skip(et, depth + 1)
        elif wire_type == DpWireType.MAP:
            kt, vt, count = self.read_map_begin()
            for _ in range(count):
                self.skip(kt, depth + 1)
                self.skip(vt, depth + 1)

    def get_value(self) -> bytes:
        return self.buf.getvalue()


# ===========================================================================
# 2. TCompact Protocol  (Thrift TCompactProtocol compatible)
#    varint encoding; field tag = (field_id << 4) | type
# ===========================================================================

class DpTCompactProtocol(DpProtocolBase):
    """Apache Thrift TCompactProtocol compatible. Varint-encoded integers."""

    def __init__(self, buffer: Optional[io.BytesIO] = None):
        self.buf = buffer or io.BytesIO()
        self._recursion_depth = 0
        self._double_s = struct.Struct("<d")  # TCompact uses LE double

    # ── Varint helpers ─────────────────────────────────────────────────────

    def _write_varint(self, value: int) -> None:
        value = value & 0xFFFFFFFFFFFFFFFF  # treat as unsigned
        while value > 0x7F:
            self.buf.write(bytes([(value & 0x7F) | 0x80]))
            value >>= 7
        self.buf.write(bytes([value & 0x7F]))

    def _read_varint(self) -> int:
        result = 0
        shift = 0
        while True:
            b = self.buf.read(1)
            if not b:
                raise DpProtocolError("TCompact: unexpected EOF reading varint")
            byte = b[0]
            result |= (byte & 0x7F) << shift
            shift += 7
            if not (byte & 0x80):
                break
        return result

    # ── Write ──────────────────────────────────────────────────────────────

    def write_field_begin(self, wire_type: int, field_id: int) -> None:
        self.buf.write(bytes([(field_id << 4) | wire_type]))

    def write_field_stop(self) -> None:
        self.buf.write(bytes([DpWireType.STOP]))

    def write_bool(self, v: bool) -> None:
        self.buf.write(bytes([1 if v else 0]))

    def write_byte(self, v: int) -> None:
        self.buf.write(struct.pack("b", v))

    def write_int16(self, v: int) -> None:
        self._write_varint(v)

    def write_int32(self, v: int) -> None:
        self._write_varint(v)

    def write_int64(self, v: int) -> None:
        self._write_varint(v)

    def write_double(self, v: float) -> None:
        self.buf.write(self._double_s.pack(v))

    def write_string(self, v: str) -> None:
        enc = v.encode("utf-8")
        self._check_length(len(enc), "string")
        self._write_varint(len(enc))
        self.buf.write(enc)

    def write_binary(self, v: bytes) -> None:
        self._check_length(len(v), "binary")
        self._write_varint(len(v))
        self.buf.write(v)

    def write_list_begin(self, element_type: int, count: int) -> None:
        self._check_count(count, "list")
        if count < 15:
            self.buf.write(bytes([(element_type << 4) | count]))
        else:
            self.buf.write(bytes([(element_type << 4) | 0x0F]))
            self._write_varint(count - 15)

    def write_set_begin(self, element_type: int, count: int) -> None:
        self.write_list_begin(element_type, count)

    def write_map_begin(self, key_type: int, value_type: int, count: int) -> None:
        self._check_count(count, "map")
        self._write_varint(count)
        if count > 0:
            self.buf.write(bytes([(key_type << 4) | value_type]))

    # ── Read ───────────────────────────────────────────────────────────────

    def read_field_begin(self) -> Tuple[int, int]:
        raw = self.buf.read(1)
        if not raw:
            return DpWireType.STOP, 0
        byte = raw[0]
        if byte == DpWireType.STOP:
            return DpWireType.STOP, 0
        wire_type = byte & 0x0F
        field_id = byte >> 4
        return wire_type, field_id

    def read_bool(self) -> bool:
        return self.buf.read(1)[0] != 0

    def read_byte(self) -> int:
        return struct.unpack("b", self.buf.read(1))[0]

    def read_int16(self) -> int:
        return self._read_varint()

    def read_int32(self) -> int:
        return self._read_varint()

    def read_int64(self) -> int:
        return self._read_varint()

    def read_double(self) -> float:
        return self._double_s.unpack(self.buf.read(8))[0]

    def read_string(self) -> str:
        length = self._read_varint()
        self._check_length(length, "string")
        return self.buf.read(length).decode("utf-8")

    def read_binary(self) -> bytes:
        length = self._read_varint()
        self._check_length(length, "binary")
        return self.buf.read(length)

    def read_list_begin(self) -> Tuple[int, int]:
        byte = self.buf.read(1)[0]
        element_type = byte & 0x0F
        count = byte >> 4
        if count == 15:
            count = self._read_varint() + 15
        self._check_count(count, "list")
        return element_type, count

    def read_set_begin(self) -> Tuple[int, int]:
        return self.read_list_begin()

    def read_map_begin(self) -> Tuple[int, int, int]:
        count = self._read_varint()
        self._check_count(count, "map")
        if count == 0:
            return 0, 0, 0
        byte = self.buf.read(1)[0]
        key_type = byte >> 4
        value_type = byte & 0x0F
        return key_type, value_type, count

    def skip(self, wire_type: int, depth: int = 0) -> None:
        self._check_depth(depth)
        if wire_type in (DpWireType.BOOL, DpWireType.BYTE):
            self.buf.read(1)
        elif wire_type in (DpWireType.INT16, DpWireType.INT32, DpWireType.INT64):
            self._read_varint()
        elif wire_type == DpWireType.DOUBLE:
            self.buf.read(8)
        elif wire_type == DpWireType.STRING:
            length = self._read_varint()
            self._check_length(length, "skip_string")
            self.buf.read(length)
        elif wire_type == DpWireType.STRUCT:
            while True:
                wt, _ = self.read_field_begin()
                if wt == DpWireType.STOP:
                    break
                self.skip(wt, depth + 1)
        elif wire_type in (DpWireType.LIST, DpWireType.SET):
            et, count = self.read_list_begin()
            for _ in range(count):
                self.skip(et, depth + 1)
        elif wire_type == DpWireType.MAP:
            kt, vt, count = self.read_map_begin()
            for _ in range(count):
                self.skip(kt, depth + 1)
                self.skip(vt, depth + 1)

    def get_value(self) -> bytes:
        return self.buf.getvalue()


# ===========================================================================
# 3. Pack Protocol  (DeukPack native .dpk)
#    = TCompact + 3-byte magic header [0x44, 0x50, 0x01]
# ===========================================================================

class DpPackProtocol(DpTCompactProtocol):
    """
    DeukPack-native protocol (.dpk).
    Header: [0x44, 0x50, 0x01] ("DP\\x01") prepended to TCompact payload.
    Wire-incompatible with Apache Thrift, but smallest footprint.
    """

    def __init__(self, buffer: Optional[io.BytesIO] = None):
        super().__init__(buffer)
        self._magic_written = False
        self._magic_skipped = False

    def _ensure_magic_written(self) -> None:
        if not self._magic_written:
            self.buf.write(DP_PACK_MAGIC)
            self._magic_written = True

    def _ensure_magic_skipped(self) -> None:
        if not self._magic_skipped:
            header = self.buf.read(3)
            if header != DP_PACK_MAGIC:
                # Not a pack payload — rewind and treat as raw TCompact
                self.buf.seek(self.buf.tell() - len(header))
            self._magic_skipped = True

    # Override write methods to prepend magic on first access
    def write_field_begin(self, wire_type: int, field_id: int) -> None:
        self._ensure_magic_written()
        super().write_field_begin(wire_type, field_id)

    def write_field_stop(self) -> None:
        self._ensure_magic_written()
        super().write_field_stop()

    def read_field_begin(self) -> Tuple[int, int]:
        self._ensure_magic_skipped()
        return super().read_field_begin()

    @staticmethod
    def is_pack_bytes(data: bytes) -> bool:
        return data[:3] == DP_PACK_MAGIC

    def get_value(self) -> bytes:
        return self.buf.getvalue()


# ===========================================================================
# 4. Protobuf Protocol  (Google Protobuf binary wire format v2/v3)
#    tag = (field_number << 3) | wire_type
#    wire_type: 0=varint, 1=64bit, 2=len-delimited, 5=32bit
# ===========================================================================

class DpProtobufProtocol(DpProtocolBase):
    """
    Google Protobuf binary wire format, v2/v3 compatible.
    Nested structs are length-prefixed (LEN-delimited, wire_type=2).
    Numeric lists use packed encoding.
    """

    # Proto wire type constants
    _PROTO_VARINT = 0  # int32, int64, sint32, sint64, bool, enum
    _PROTO_I64    = 1  # fixed64, sfixed64, double
    _PROTO_LEN    = 2  # string, bytes, sub-message, packed-repeated
    _PROTO_I32    = 5  # fixed32, sfixed32, float

    # Mapping from DpWireType → proto wire type
    _DP_TO_PROTO = {
        DpWireType.BOOL:   _PROTO_VARINT,
        DpWireType.BYTE:   _PROTO_VARINT,
        DpWireType.INT16:  _PROTO_VARINT,
        DpWireType.INT32:  _PROTO_VARINT,
        DpWireType.INT64:  _PROTO_VARINT,
        DpWireType.DOUBLE: _PROTO_I64,
        DpWireType.STRING: _PROTO_LEN,
        DpWireType.STRUCT: _PROTO_LEN,
        DpWireType.LIST:   _PROTO_LEN,
        DpWireType.SET:    _PROTO_LEN,
        DpWireType.MAP:    _PROTO_LEN,
    }

    _PACKABLE = {DpWireType.BOOL, DpWireType.BYTE, DpWireType.INT16,
                 DpWireType.INT32, DpWireType.INT64, DpWireType.DOUBLE}

    def __init__(self, buffer: Optional[io.BytesIO] = None):
        self.buf = buffer or io.BytesIO()
        # Sub-message stack: list of BytesIO for nested struct buffering
        self._stack: List[io.BytesIO] = []
        self._double_s = struct.Struct("<d")

    def _cur(self) -> io.BytesIO:
        return self._stack[-1] if self._stack else self.buf

    # ── Varint helpers ─────────────────────────────────────────────────────

    def _write_varint(self, value: int, to: Optional[io.BytesIO] = None) -> None:
        dest = to or self._cur()
        v = value & 0xFFFFFFFFFFFFFFFF
        while v > 0x7F:
            dest.write(bytes([(v & 0x7F) | 0x80]))
            v >>= 7
        dest.write(bytes([v & 0x7F]))

    def _read_varint(self, from_: Optional[io.BytesIO] = None) -> int:
        src = from_ or self._cur()
        result, shift = 0, 0
        while True:
            b = src.read(1)
            if not b:
                raise DpProtocolError("Protobuf: EOF reading varint")
            byte = b[0]
            result |= (byte & 0x7F) << shift
            shift += 7
            if not (byte & 0x80):
                break
        return result

    # ── Write ──────────────────────────────────────────────────────────────

    def write_field_begin(self, wire_type: int, field_id: int) -> None:
        proto_wt = self._DP_TO_PROTO.get(wire_type, self._PROTO_LEN)
        tag = (field_id << 3) | proto_wt
        self._write_varint(tag)
        if wire_type == DpWireType.STRUCT:
            # Push child buffer for length-prefix
            self._stack.append(io.BytesIO())

    def write_field_stop(self) -> None:
        # Protobuf has no STOP field; pop nested struct buffer instead
        pass

    def write_struct_end(self) -> None:
        """Must be called after writing all fields of a nested struct."""
        if self._stack:
            child_bytes = self._stack.pop().getvalue()
            self._write_varint(len(child_bytes))
            self._cur().write(child_bytes)

    def write_bool(self, v: bool) -> None:
        self._write_varint(1 if v else 0)

    def write_byte(self, v: int) -> None:
        self._write_varint(v & 0xFF)

    def write_int16(self, v: int) -> None:
        self._write_varint(v & 0xFFFF)

    def write_int32(self, v: int) -> None:
        self._write_varint(v & 0xFFFFFFFF)

    def write_int64(self, v: int) -> None:
        self._write_varint(v & 0xFFFFFFFFFFFFFFFF)

    def write_double(self, v: float) -> None:
        self._cur().write(self._double_s.pack(v))

    def write_string(self, v: str) -> None:
        enc = v.encode("utf-8")
        self._check_length(len(enc), "string")
        self._write_varint(len(enc))
        self._cur().write(enc)

    def write_binary(self, v: bytes) -> None:
        self._check_length(len(v), "binary")
        self._write_varint(len(v))
        self._cur().write(v)

    def write_list_begin(self, element_type: int, count: int) -> None:
        self._check_count(count, "list")
        # For packable types, elements will be written into a temp buffer
        if element_type in self._PACKABLE:
            self._stack.append(io.BytesIO())
        # else: each element emits its own tag via caller

    def write_list_end(self, element_type: int) -> None:
        if element_type in self._PACKABLE and self._stack:
            packed = self._stack.pop().getvalue()
            self._write_varint(len(packed))
            self._cur().write(packed)

    def write_set_begin(self, element_type: int, count: int) -> None:
        self.write_list_begin(element_type, count)

    def write_set_end(self, element_type: int) -> None:
        self.write_list_end(element_type)

    def write_map_begin(self, key_type: int, value_type: int, count: int) -> None:
        self._check_count(count, "map")

    def write_map_end(self) -> None:
        pass

    # ── Read ───────────────────────────────────────────────────────────────

    def read_field_begin(self) -> Tuple[int, int]:
        src = self._cur()
        peek = src.read(1)
        if not peek or peek[0] == 0:
            return DpWireType.STOP, 0
        src.seek(src.tell() - 1)
        tag = self._read_varint()
        if tag == 0:
            return DpWireType.STOP, 0
        proto_wt = tag & 0x07
        field_id = tag >> 3
        dp_type = self._proto_to_dp(proto_wt)
        return dp_type, field_id

    def _proto_to_dp(self, proto_wt: int) -> int:
        if proto_wt == self._PROTO_VARINT: return DpWireType.INT64
        if proto_wt == self._PROTO_I64:    return DpWireType.DOUBLE
        if proto_wt == self._PROTO_LEN:    return DpWireType.STRING
        if proto_wt == self._PROTO_I32:    return DpWireType.INT32
        return DpWireType.BYTE

    def read_bool(self) -> bool:
        return self._read_varint() != 0

    def read_byte(self) -> int:
        return self._read_varint() & 0xFF

    def read_int16(self) -> int:
        v = self._read_varint()
        return (v << 16) >> 16

    def read_int32(self) -> int:
        v = self._read_varint()
        return (v & 0xFFFFFFFF) if v >= 0 else v

    def read_int64(self) -> int:
        return self._read_varint()

    def read_double(self) -> float:
        return self._double_s.unpack(self._cur().read(8))[0]

    def read_string(self) -> str:
        length = self._read_varint()
        self._check_length(length, "string")
        return self._cur().read(length).decode("utf-8")

    def read_binary(self) -> bytes:
        length = self._read_varint()
        self._check_length(length, "binary")
        return self._cur().read(length)

    def read_list_begin(self) -> Tuple[int, int]:
        # Packed encoding: read sub-buffer
        length = self._read_varint()
        sub = io.BytesIO(self._cur().read(length))
        self._stack.append(sub)
        # Count elements by trying to advance (heuristic for varint-packed)
        count = 0
        saved = sub.tell()
        try:
            while sub.tell() < length:
                self._read_varint(sub)
                count += 1
        except Exception:
            pass
        sub.seek(saved)
        return DpWireType.INT32, count  # best-effort type

    def read_list_end(self) -> None:
        if self._stack:
            self._stack.pop()

    def read_set_begin(self) -> Tuple[int, int]:
        return self.read_list_begin()

    def read_set_end(self) -> None:
        self.read_list_end()

    def read_map_begin(self) -> Tuple[int, int, int]:
        return DpWireType.STRING, DpWireType.I32, 0  # Protobuf maps are complex

    def read_map_end(self) -> None:
        pass

    def skip(self, proto_dp_type: int) -> None:
        """Skip a field by its DpWireType (best-effort)."""
        if proto_dp_type in (DpWireType.BOOL, DpWireType.BYTE,
                               DpWireType.INT16, DpWireType.INT32, DpWireType.INT64):
            self._read_varint()
        elif proto_dp_type == DpWireType.DOUBLE:
            self._cur().read(8)
        elif proto_dp_type in (DpWireType.STRING,):
            n = self._read_varint()
            self._cur().read(n)
        elif proto_dp_type == DpWireType.STRUCT:
            n = self._read_varint()
            self._cur().read(n)

    def get_value(self) -> bytes:
        return self.buf.getvalue()

    # ── Zigzag helpers (for sint32 / sint64) ──────────────────────────────

    @staticmethod
    def zigzag_encode32(n: int) -> int:
        return ((n << 1) ^ (n >> 31)) & 0xFFFFFFFF

    @staticmethod
    def zigzag_decode32(n: int) -> int:
        return ((n >> 1) ^ -(n & 1))

    @staticmethod
    def zigzag_encode64(n: int) -> int:
        return ((n << 1) ^ (n >> 63)) & 0xFFFFFFFFFFFFFFFF

    @staticmethod
    def zigzag_decode64(n: int) -> int:
        return ((n >> 1) ^ -(n & 1))


# ===========================================================================
# 5. JSON Protocol  (field-id keyed JSON for interop)
# ===========================================================================

class DpJsonProtocol(DpProtocolBase):
    """
    JSON protocol: serializes structs as JSON objects.
    By default uses field_id as key (e.g. {"1": ..., "2": ...}).
    Set use_field_names=True for human-readable keys (requires schema).
    """

    def __init__(self, use_field_names: bool = False,
                 schema: Optional[Dict[int, str]] = None):
        self._obj: Dict[str, Any] = {}
        self._stack: List[Dict[str, Any]] = [self._obj]
        self._use_names = use_field_names
        self._schema = schema or {}
        self._read_data: Dict[str, Any] = {}
        self._read_iter: Optional[iter] = None

    def _key(self, field_id: int) -> str:
        if self._use_names and field_id in self._schema:
            return self._schema[field_id]
        return str(field_id)

    # ── Write ──────────────────────────────────────────────────────────────

    def write_field_begin(self, wire_type: int, field_id: int) -> None:
        self._current_key = self._key(field_id)

    def write_field_stop(self) -> None:
        pass

    def _write_val(self, v: Any) -> None:
        curr = self._stack[-1]
        if isinstance(curr, list):
            curr.append(v)
        else:
            curr[self._current_key] = v

    def write_bool(self, v: bool) -> None:
        self._write_val(v)

    def write_byte(self, v: int) -> None:
        self._write_val(v)

    def write_int16(self, v: int) -> None:
        self._write_val(v)

    def write_int32(self, v: int) -> None:
        self._write_val(v)

    def write_int64(self, v: int) -> None:
        self._write_val(v)

    def write_double(self, v: float) -> None:
        self._write_val(v)

    def write_string(self, v: str) -> None:
        self._write_val(v)

    def write_binary(self, v: bytes) -> None:
        import base64
        self._write_val(base64.b64encode(v).decode("ascii"))

    def write_list_begin(self, element_type: int, count: int) -> None:
        lst: List[Any] = []
        self._write_val(lst)
        self._stack.append(lst)  # type: ignore[arg-type]

    def write_list_end(self, *_: Any) -> None:
        self._stack.pop()

    def write_set_begin(self, element_type: int, count: int) -> None:
        self.write_list_begin(element_type, count)

    def write_set_end(self, *_: Any) -> None:
        self.write_list_end()

    def write_map_begin(self, key_type: int, value_type: int, count: int) -> None:
        d: Dict[str, Any] = {}
        self._write_val(d)
        self._stack.append(d)  # type: ignore[arg-type]

    def write_map_end(self) -> None:
        self._stack.pop()

    def get_value(self) -> bytes:
        return _json.dumps(self._obj, ensure_ascii=False).encode("utf-8")

    def get_json(self) -> Dict[str, Any]:
        return self._obj

    # ── Read ───────────────────────────────────────────────────────────────

    @classmethod
    def from_bytes(cls, data: bytes, **kwargs: Any) -> "DpJsonProtocol":
        instance = cls(**kwargs)
        instance._read_data = _json.loads(data.decode("utf-8"))
        instance._read_iter = iter(instance._read_data.items())
        return instance

    def read_field_begin(self) -> Tuple[int, int]:
        try:
            key, val = next(self._read_iter)  # type: ignore[arg-type]
            self._current_read_val = val
            field_id = int(key) if key.isdigit() else 0
            # Infer wire type from value
            wt = self._infer_wire_type(val)
            return wt, field_id
        except StopIteration:
            return DpWireType.STOP, 0

    def _infer_wire_type(self, val: Any) -> int:
        if isinstance(val, bool):   return DpWireType.BOOL
        if isinstance(val, int):    return DpWireType.INT64
        if isinstance(val, float):  return DpWireType.DOUBLE
        if isinstance(val, str):    return DpWireType.STRING
        if isinstance(val, list):   return DpWireType.LIST
        if isinstance(val, dict):   return DpWireType.STRUCT
        return DpWireType.STRING

    def read_bool(self)   -> bool:  return bool(self._current_read_val)
    def read_byte(self)   -> int:   return int(self._current_read_val)
    def read_int16(self)    -> int:   return int(self._current_read_val)
    def read_int32(self)    -> int:   return int(self._current_read_val)
    def read_int64(self)    -> int:   return int(self._current_read_val)
    def read_double(self) -> float: return float(self._current_read_val)
    def read_string(self) -> str:   return str(self._current_read_val)

    def read_binary(self) -> bytes:
        import base64
        return base64.b64decode(self._current_read_val)

    def skip(self, _wire_type: int) -> None:
        pass  # JSON field already consumed


# ===========================================================================
# 6. Unified factory  — DpProtocol.create(format)
# ===========================================================================

class DpProtocol:
    """
    Unified factory and alias class.
    Usage:
        prot = DpProtocol.create('tbinary')
        prot = DpProtocol.create('tcompact')
        prot = DpProtocol.create('pack')
        prot = DpProtocol.create('protobuf')
        prot = DpProtocol.create('json')
    """

    @staticmethod
    def create(
        fmt: str = "tbinary",
        buffer: Optional[io.BytesIO] = None,
        little_endian: bool = False,
        **kwargs: Any,
    ):
        fmt = fmt.lower()
        if fmt == "tbinary":
            return DpTBinaryProtocol(buffer, little_endian=little_endian)
        if fmt == "tcompact":
            return DpTCompactProtocol(buffer)
        if fmt in ("pack", "dpk"):
            return DpPackProtocol(buffer)
        if fmt in ("protobuf", "proto", "pb"):
            return DpProtobufProtocol(buffer)
        if fmt == "json":
            return DpJsonProtocol(**kwargs)
        raise DpProtocolError(f"Unknown DeukPack protocol format: '{fmt}'")

    @staticmethod
    def detect(data: bytes) -> str:
        """Best-effort detection of the protocol used to encode `data`."""
        if data[:3] == DP_PACK_MAGIC:
            return "pack"
        try:
            _json.loads(data)
            return "json"
        except Exception:
            pass
        return "tbinary"  # default fallback


# ===========================================================================
# Convenience aliases (mirrors TypeScript exports style)
# ===========================================================================

TBinaryProtocol  = DpTBinaryProtocol
TCompactProtocol = DpTCompactProtocol
PackProtocol     = DpPackProtocol
ProtobufProtocol = DpProtobufProtocol
JsonProtocol     = DpJsonProtocol
