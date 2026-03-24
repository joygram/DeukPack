/**
 * Native C++ wire primitives: Binary (fixed-width + Thrift-style string/binary)
 * and Compact (varint length + string). No Node/N-API.
 */
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "binary_reader.h"
#include "binary_writer.h"
#include "compact_reader.h"
#include "compact_writer.h"

using deukpack::BinaryReader;
using deukpack::BinaryWriter;
using deukpack::CompactReader;
using deukpack::CompactWriter;
using deukpack::Endianness;

static int fail(const char *msg)
{
    std::fprintf(stderr, "[wire_roundtrip_test] FAIL: %s\n", msg);
    return 1;
}

static int test_binary_le_roundtrip()
{
    BinaryWriter w(Endianness::Little);
    w.WriteByte(0xab);
    w.WriteI16(-1000);
    w.WriteI32(-42);
    w.WriteI64(static_cast<int64_t>(0x123456789abcdefLL));
    w.WriteDouble(3.141592653589793);
    w.WriteString("hello-deukpack");
    std::vector<uint8_t> bin = {1, 2, 3, 255};
    w.WriteBinary(bin);

    std::vector<uint8_t> buf = w.GetBuffer();
    BinaryReader r(buf.data(), buf.size(), Endianness::Little);

    if (r.ReadByte() != 0xab) return fail("LE ReadByte");
    if (r.ReadI16() != -1000) return fail("LE ReadI16");
    if (r.ReadI32() != -42) return fail("LE ReadI32");
    if (r.ReadI64() != static_cast<int64_t>(0x123456789abcdefLL)) return fail("LE ReadI64");
    if (std::abs(r.ReadDouble() - 3.141592653589793) > 1e-15) return fail("LE ReadDouble");
    if (r.ReadString() != "hello-deukpack") return fail("LE ReadString");
    std::vector<uint8_t> back = r.ReadBinary();
    if (back != bin) return fail("LE ReadBinary");
    if (!r.IsAtEnd()) return fail("LE trailing bytes");
    return 0;
}

static int test_binary_be_roundtrip()
{
    BinaryWriter w(Endianness::Big);
    w.WriteI32(0x01020304);
    std::vector<uint8_t> buf = w.GetBuffer();
    if (buf.size() < 4) return fail("BE buffer size");
    if (buf[0] != 1 || buf[1] != 2 || buf[2] != 3 || buf[3] != 4) return fail("BE byte order");

    BinaryReader r(buf.data(), buf.size(), Endianness::Big);
    if (r.ReadI32() != 0x01020304) return fail("BE ReadI32");
    return 0;
}

static int test_compact_positive_varint_and_string()
{
    // CompactWriter::WriteVarInt uses a simple loop; use non-negative values (see implementation).
    CompactWriter cw;
    cw.WriteVarInt(0);
    cw.WriteVarInt(127);
    cw.WriteVarInt(128);
    cw.WriteVarInt(16384);
    cw.WriteString("compact-ok");

    std::vector<uint8_t> buf = cw.GetBuffer();
    CompactReader cr(buf.data(), buf.size());

    if (cr.ReadVarInt() != 0) return fail("compact varint 0");
    if (cr.ReadVarInt() != 127) return fail("compact varint 127");
    if (cr.ReadVarInt() != 128) return fail("compact varint 128");
    if (cr.ReadVarInt() != 16384) return fail("compact varint 16384");
    if (cr.ReadString() != "compact-ok") return fail("compact string");
    if (!cr.IsAtEnd()) return fail("compact trailing");
    return 0;
}

int main()
{
    if (int e = test_binary_le_roundtrip()) return e;
    if (int e = test_binary_be_roundtrip()) return e;
    if (int e = test_compact_positive_varint_and_string()) return e;
    return 0;
}
