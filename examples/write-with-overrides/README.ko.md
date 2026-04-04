# Pack(overrides) 샘플 가이드

동일 메시지를 `여러 수신자`에게 보낼 때 **소수 필드만` 바꾸는 패턴입니다. `IDL 변경 없이** 생성 코드에 포함됩니다.

## 사전 요건

- 코어 저장소 루트에서 `npm run build`
- `bash examples/scripts/gen-sample.sh` (또는 Windows `examples\scripts\gen-sample.cmd`)

## 예제 IDL 필드 ID (`sample_idl/sample.deuk`)

```deuk
namespace tutorial

struct DemoUser {
  1> int32 id
  2> string name
  3> DemoPoint home
}
```

생성된 각 struct에는 **`FieldId`** 상수가 자동으로 포함됩니다.

| 필드 ID | 필드 | C# `FieldId` 상수 | C++ 상수 | JS |
|--------|------|---------------------|----------|-----|
| 1 | id | `DemoUser.FieldId.Id` | `DemoUser::kFieldId_Id` | `DemoUser.FieldId.Id` |
| 2 | name | `DemoUser.FieldId.Name` | `DemoUser::kFieldId_Name` | `DemoUser.FieldId.Name` |
| 3 | home | `DemoUser.FieldId.Home` | `DemoUser::kFieldId_Home` | `DemoUser.FieldId.Home` |

## C#

생성된 `tutorial.DemoUser`에 `Pack` 유니파이드 API 래퍼와 `FieldId`가 포함됩니다.

```csharp
var u = new tutorial.DemoUser
{
    Id = 1,
    Name = "shared",
    Home = new tutorial.DemoPoint { X = 0, Y = 0 }
};

// 수신자 A: 이름만 다르게 직렬화 (인스턴스는 그대로)
byte[] binA = tutorial.DemoUser.Pack(u, overrides: new Dictionary<int, object> {
    { tutorial.DemoUser.FieldId.Name, "Alice" }
});

// 수신자 B
byte[] binB = tutorial.DemoUser.Pack(u, overrides: new Dictionary<int, object> {
    { tutorial.DemoUser.FieldId.Name, "Bob" }
});
```

실행 샘플은 [consumer-csharp](../consumer-csharp/README.md)에서 코드젠 후 테스트해볼 수 있습니다.

## JavaScript

`--js`로 생성한 `javascript/generated_deuk.js`:

```javascript
var msg = { id: 1, name: "shared", home: { x: 0, y: 0 } };
var bin = DemoUser.pack(msg, { overrides: { [DemoUser.FieldId.Name]: "Alice" } });
```

## C++

```cpp
std::unordered_map<int, std::any> o;
o[DemoUser::kFieldId_Name] = std::string("Alice");
user.apply_overrides(o);
```

## 더 읽을 것

- [DEUKPACK_WRITE_WITH_OVERRIDES_API.md](../../docs/DEUKPACK_WRITE_WITH_OVERRIDES_API.md)
- [DEUKPACK_WIRE_PROFILE_SUBSET.md](../../docs/DEUKPACK_WIRE_PROFILE_SUBSET.md) (와이어 프로파일 서브셋은 별도 기능)
- [deukpack.app — Write with overrides](https://deukpack.app/ko/tutorial/write-with-overrides/)
