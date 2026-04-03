# C++ consumer sample

1. Repo root: `bash examples/scripts/gen-sample.sh`
2. From this folder:

```bash
cmake -B build -S .
cmake --build build
./build/demo
```

Windows: `build\Release\demo.exe` or `build\demo.exe` depending on generator.

---

## ⚙️ C++ API Interface Guidelines: Factory vs Zero-Alloc

DeukPack provides two distinct `Unpack` interfaces. While modern C++ performs zero-copy via stack memory out-of-the-box (RVO), choosing the correct interface prevents heap fragmentation if your structs contain dynamic sub-containers (e.g. `std::vector`, `std::map`).

### 1. Zero-Allocation (High-Performance Overwrite)
**Signature:** `Hero::Unpack(hero, buffer)`  
**Usage:** For high-frequency network packets or real-time simulation updates.  
**How it works:** Pass a pre-allocated instance. The method clears and overwrites internal containers (`std::vector::clear()`) instead of destroying them, preserving internal heap capacity and dodging mutex locks associated with the OS heap memory allocator.

```cpp
// Initialization (do this once)
tutorial::DemoUser cachedHero;

// Update Loop (Network thread)
// Reuses capacity inside cachedHero.home, cachedHero.items, etc.
tutorial::DemoUser::Unpack(cachedHero, binaryData); 
```

### 2. Factory Method (Value Return)
**Signature:** `auto hero = Hero::Unpack(buffer)`  
**Usage:** For one-time initialization, local parsing, or configs.  
**How it works:** Instantiates the object on the stack and returns by value. High performance due to Return Value Optimization (RVO), but deeply nested dynamic containers will result in new OS heap allocations.

```cpp
// Excellent for non-hotpaths
auto hero = tutorial::DemoUser::Unpack(binaryData);
```
