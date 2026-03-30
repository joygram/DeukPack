# Part 2: Uniting Protobuf, Thrift, and OpenAPI: The Birth of the DeukPack Multi-Hub

In the previous article, we discussed how crucial 'schema-first development' is in the era of distributed systems and AI coding. At this point, a natural question arises:

> "If we need a schema, shouldn't we just use industry standards like Google's Protobuf or Apache Thrift?"

That's a valid point. Protobuf and Thrift are excellent tools proven across countless large-scale services. However, **when you try to apply these tools directly to real-world game development and complex mobile/web pipelines, you run into deep frustrations and limitations.**

DeukPack was born precisely from those practical 'pain points'.

## Fragmented Standards and the Limitations of Existing Tools

### 1. The Heaviness and Inflexibility of Protobuf
Protobuf is incredibly powerful when combined with the gRPC ecosystem for communication between microservices. However, it feels quite alien **when you try to use it for real-time game servers running on raw TCP sockets** or **integrate it with other data pipelines like Excel.**
* The Varint-heavy wire format offers good compression, but introduces CPU overhead during serialization/deserialization.
* The `protoc` runtime library itself is heavy, and the generated code API is often unintuitive for C# or C++ developers.

### 2. The Outdated Pipeline of Apache Thrift
On the other hand, Thrift has a much more explicit byte structure and faster parsing. But currently, the Apache Thrift project's C# and TS generators are somewhat neglected and fail to fully support modern language specs (e.g., C# 10+, latest TypeScript).
* In a C# environment where minimizing memory allocation is critical, the legacy Thrift library is a primary culprit for Garbage Collection (GC) spikes.
* The build (code generation) speed is too slow, causing bottlenecks in large schema trees.

### 3. "Network Packets Here, Designer's Excel Data There"
This is the most critical limitation. When building games or complex apps, the structure of network communication packets and the structure of balance/meta-data managed by designers in Excel are essentially the same. Because existing tools focus solely on network serialization, pipelines to parse and validate Excel data had to be built from scratch every time.

## DeukPack's Philosophy: A Universal Schema Multi-Hub

We didn't want to reject existing great tools and force an entirely alien wire format. Instead, we needed a **Universal Schema Multi-hub** to unite these fragmented standards. DeukPack is an engine that embraces existing stable assets (Thrift, Protobuf, OpenAPI) while **making the developer's work pipeline incredibly smooth.**

1. **Thrift-Compatible Wire Format + Overwhelming Optimization**
   DeukPack's `DpBinaryProtocol` adopts a structure compatible with Thrift's TBinaryProtocol, keeping interoperability open with existing servers or systems. However, the internal implementation was completely rewritten using `ArrayPool` and Zero-Copy techniques. In C#, this **reduced memory usage by more than 5 times and dramatically boosted serialization speed.**

2. **Multi-Format IDL Integrated Engine**
   DeukPack's powerful AST (Abstract Syntax Tree) engine is designed to read not only its proprietary `.deuk` syntax but also legacy `.thrift` files, and eventually `.proto` and OpenAPI specs, processing them all within a single pipeline.

3. **Unifying Network and Excel (GetSchema)**
   This is our biggest differentiator. DeukPack embeds `GetSchema()` metadata into generated C# objects, providing field information without runtime reflection. Thanks to this single feature, developers can use the schema created for network packets to **instantly generate editor tools that auto-generate Excel headers and validate data.**

## An Ecosystem Tool for the AI Era

While Protobuf and Thrift focused merely on 'network communication protocols', **DeukPack is an ecosystem integration hub that embraces Protobuf, Thrift, OpenAPI, and even Excel metadata, providing extremely fast multi-language codegen and wire coexistence.**

---
> **Explore the DeukPack Project:**
> Official Site: deukpack.app  
> GitHub: DeukPack Repository