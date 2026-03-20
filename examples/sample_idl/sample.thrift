// Minimal IDL for examples — C# / C++ / JS codegen smoke test
namespace csharp tutorial
namespace cpp tutorial

struct DemoPoint {
  1: i32 x;
  2: i32 y;
}

struct DemoUser {
  1: i32 id;
  2: string name;
  3: DemoPoint home;
}
