// Minimal IDL for examples — C# / C++ / JS codegen smoke test
// DemoUser: WriteWithOverrides. UserRecord: WriteFields. UserBase/UserFull: extends.
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

// WriteFields sample: project a subset of fields at runtime
struct UserRecord {
  1: i32 id;
  2: string displayName;
  3: i32 level;
  4: string avatarUrl;
}

// extends sample: parent fields merged into child at codegen
struct UserBase {
  1: i32 id;
  2: string tag;
}
struct UserFull extends UserBase {
  3: i32 level;
}
