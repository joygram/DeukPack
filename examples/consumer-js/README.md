# JavaScript sample (call codegen from Node)

Runs the same CLI as CI: `node scripts/build_deukpack.js … --js`.

```bash
cd examples/consumer-js
npm install
npm run codegen
npm run demo
```

- **codegen**: generates `examples/generated/js/generated_deuk.js` (meta/editor-oriented bundle).
- **demo**: runs Pack, Pack, projectFields against generated code (requires codegen first).

---

## ⚡ JavaScript API Interface Guidelines: V8 Optimization

Unlike C# or C++, the **JavaScript ecosystem (V8/Node) uniquely benefits from the Factory method (`unpack(bin)`)**. While DeukPack technically provides an overwrite interface for JS, you should generally default to the factory method.

### 1. Factory Method (Recommended Standard)
**Signature:** `const hero = Dto.Hero.unpack(buffer)`  
**Usage:** The standard for Node.js, Web Browsers, and modern TS environments.  
**How it works:** Returns a newly constructed JavaScript Object.  

```javascript
// Extremely fast in V8
const hero = Dto.Hero.unpack(binaryData);
```

### 2. In-Place Update (Advanced Scenario)
**Signature:** `Dto.Hero.unpack(hero, buffer)`  
**Usage:** Only if you are building an explicit WebGL game engine (e.g. Three.js / Phaser) where you manage a strict memory pool and frame-rate is aggressively tied to object count.  
**How it works:** Uses `Object.assign(hero, newParsedData)` heavily, merging data.
