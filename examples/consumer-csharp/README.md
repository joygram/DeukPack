# C# consumer sample

1. Repo root: `npm run build` → `bash examples/scripts/gen-sample.sh` (or `gen-sample.cmd`).
2. `dotnet run --project examples/consumer-csharp`

References **`DeukPack.Protocol/DeukPack.Protocol.csproj`** (full `IDeukPack`, `DpProtocol`, …) and generated `examples/generated/csharp/*.cs`.

For **npm-only** installs without the repo: link your game’s existing DeukPack/Thrift runtime assembly the same way — not only `dist/csharp/*.cs`.

**Pack**: After codegen, `tutorial.DemoUser` includes `Pack(oprot, overrides)` — use field IDs **1** = id, **2** = name, **3** = home. See [examples/write-with-overrides/README.md](../write-with-overrides/README.md) and the [site tutorial](https://deukpack.app/tutorial/write-with-overrides/).

---

## 🚨 API Interface Guidelines: Factory vs Zero-Alloc

DeukPack provides two distinct `Unpack` interfaces to support both ease-of-use and extreme performance. **You must choose the correct interface based on your use case.**

### 1. Zero-Allocation (High-Performance Hotpath)
**Signature:** `Hero.Unpack(hero, buffer)`  
**Usage:** For high-frequency network packets (e.g., MMO position sync, 60+ ticks/sec).  
**How it works:** You pre-allocate a model instance once (`new Hero()`). The `Unpack` method safely overwrites the fields of your pre-allocated instance without allocating new memory, avoiding Unity Garbage Collection (GC) spikes and frame drops.

```csharp
// Initialization (do this once)
var cachedHero = new tutorial.DemoUser();

// Update Loop / Network Hotpath (runs 60 times a second)
// NO `new` occurs here. It overwrites `cachedHero` safely.
tutorial.DemoUser.Unpack(cachedHero, binaryData); 
```

### 2. Factory Method (Convenience)
**Signature:** `var hero = Hero.Unpack(buffer)`  
**Usage:** For one-time initialization, configs, or low-frequency HTTP/RPC responses.  
**How it works:** The method internally allocates memory (`new Hero()`) and returns the populated object. 

> [!CAUTION]
> **DO NOT use the Factory Method in loops or real-time gameplay networks.** Creating new objects per packet will quickly bloat the Unity Heap, triggering expensive "Stop-The-World" Garbage Collection sweeps that cause extreme game stuttering.
