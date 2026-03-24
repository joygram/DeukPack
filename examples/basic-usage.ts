/**
 * DeukPack Basic Usage Example
 * Demonstrates core functionality
 */

import { DeukPack } from '../src/index';

async function basicUsageExample() {
  console.log('🚀 DeukPack Basic Usage Example\n');
  
  // Create engine instance
  const engine = new DeukPack();
  
  // Example 1: Simple serialization
  console.log('📦 Example 1: Simple Serialization');
  console.log('===================================');
  
  const user = {
    id: 12345,
    name: "John Doe",
    email: "john@example.com",
    age: 30,
    active: true,
    scores: [95, 87, 92, 88],
    metadata: {
      created: "2024-01-01",
      updated: "2024-01-15",
      version: 1
    }
  };
  
  // Deuk native: tagged binary (pack). Thrift binary/compact → C#·생성 코드.
  const binaryData = engine.serialize(user, {
    wireFamily: 'deuk',
    protocol: 'pack',
    endianness: 'LE',
    optimizeForSize: true,
    includeDefaultValues: false,
    validateTypes: true
  });
  
  console.log(`Original size: ${JSON.stringify(user).length} bytes`);
  console.log(`Binary size: ${binaryData.length} bytes`);
  console.log(`Compression ratio: ${(JSON.stringify(user).length / binaryData.length).toFixed(2)}x\n`);
  
  // Example 2: Protocol comparison
  console.log('📦 Example 2: Protocol Comparison');
  console.log('==================================');
  
  const deukProtocols = ['pack', 'json', 'yaml'] as const;
  const protocolResults: { [key: string]: { size: number; time: number } } = {};
  
  for (const protocol of deukProtocols) {
    const start = performance.now();
    const data = engine.serialize(user, {
      wireFamily: 'deuk',
      protocol,
      endianness: 'LE',
      optimizeForSize: true,
      includeDefaultValues: false,
      validateTypes: true
    });
    const end = performance.now();
    
    protocolResults[protocol] = {
      size: data.length,
      time: end - start
    };
  }
  
  for (const [protocol, results] of Object.entries(protocolResults)) {
    console.log(`${protocol.toUpperCase()}:`);
    console.log(`  Size: ${results.size} bytes`);
    console.log(`  Time: ${results.time.toFixed(4)}ms`);
  }
  
  console.log('');
  
  // Example 3: Performance test
  console.log('📦 Example 3: Performance Test');
  console.log('===============================');
  
  const iterations = 10000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    engine.serialize(user, {
      wireFamily: 'deuk',
      protocol: 'pack',
      endianness: 'LE',
      optimizeForSize: true,
      includeDefaultValues: false,
      validateTypes: true
    });
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = Math.round(1000 / avgTime);
  
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average per operation: ${avgTime.toFixed(4)}ms`);
  console.log(`Operations per second: ${opsPerSec.toLocaleString()}\n`);
  
  // Example 4: Memory usage
  console.log('📦 Example 4: Memory Usage');
  console.log('===========================');
  
  const memBefore = process.memoryUsage();
  
  // Create multiple objects
  const objects = [];
  for (let i = 0; i < 1000; i++) {
    objects.push({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50),
      active: i % 2 === 0
    });
  }
  
  const memAfter = process.memoryUsage();
  const memUsed = memAfter.heapUsed - memBefore.heapUsed;
  
  console.log(`Memory before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Memory after: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Memory used: ${(memUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Memory per object: ${(memUsed / 1024 / 1000).toFixed(2)}KB\n`);
  
  // Example 5: Engine info
  console.log('📦 Example 5: Engine Information');
  console.log('=================================');
  
  const info = engine.getEngineInfo();
  console.log(`Engine: ${info.name}`);
  console.log(`Version: ${info.version}`);
  console.log(`Native: ${info.native ? 'Yes' : 'No'}\n`);
  
  console.log('✅ Basic usage example completed!');
}

// Run example
basicUsageExample().catch(console.error);
