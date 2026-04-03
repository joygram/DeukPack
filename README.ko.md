# DeukPack: AI-Native 유니버설 스키마 멀티 허브 (Protobuf, Thrift, OpenAPI 통합)

> **Protobuf, Thrift, OpenAPI를 하나로 묶는 고성능 유니버설 스키마 멀티 허브(Multi-hub).**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![npm downloads](https://img.shields.io/npm/dm/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![GitHub stars](https://img.shields.io/github/stars/joygram/DeukPack.svg?style=social)](https://github.com/joygram/DeukPack/stargazers)

**언어 / Languages:** [English](README.md) · [한국어](README.ko.md)

어떤 IDL이든(Protobuf, OpenAPI, JSON Schema, `.deuk`) **타입 안전 결정론적 코드**로 변환 — C#, C++, TypeScript, JavaScript, Java, Elixir — **단 하나의 통합 직렬화 API**로.

---

> [!WARNING]
> ### 🚨 [필독] 코어 아키텍처 대통합 & 마이그레이션 노티스 (v1.8.0+)
> 기존 언어별 통합 코어 모듈 구조가 **`DeukPackCodec`**으로 전면 최적화 및 통합되었습니다!
> 
> - **초간편 통일 API:** 더 이상 장황한 팩토리를 부를 필요가 없습니다. 이제 모든 언어에서 직관적으로 구조체 자체의 **`Hero.Pack()`** 과 **`Hero.Unpack()`** (2-Method) 문법을 공통으로 사용합니다. (하위 호환성을 위해 구 API도 당분간 유지됩니다.)
> - **⚠️ 주의사항 (C# / Unity 사용자):** UPM을 사용하지 않고 생성된 `.cs` 런타임 파일들을 직접 복붙해 사용하신 분들은, 이름 충돌을 막기 위해 **반드시 기존 런타임 폴더를 전부 삭제(초기화)하신 후** 새 코드를 복사해 넣어주세요. (npm 사용자는 무시하셔도 됩니다.)

---

## 왜 DeukPack인가: AI-Ready의 이점

### 1. 유니버설 IDL 게이트웨이 (OpenAPI, JSON Schema, Protobuf, Thrift, CSV)
현대 시스템은 레거시(Thrift), 현대적(Protobuf/gRPC), 웹 기반(OpenAPI/JSON Schema) 인터페이스가 뒤섞여 있습니다. DeukPack은 **단일 진실 공급원(Single Source of Truth)**으로 다양한 IDL을 하나의 통합 모델로 집약하며 — 기존 레거시 프로토콜과 완전한 와이어 호환성을 유지합니다.

### 2. IDL-to-AI 시맨틱 매핑

IDL 주석과 필드 구조에서 메타데이터를 추출하여 AI가 즉시 이해할 수 있는 **의미론적 맥락(Semantic Context)**으로 전환합니다. 엔지니어는 데이터 계보(Lineage)를 기계 판독 가능한 형태로 설계하는 아키텍트로 진화합니다.

### 3. AI-Native 실행 브리지 (MCP 플러그인 지원)

**MCP(Model Context Protocol) 서버 자동 생성** 기능(`DeukPackMcp`)을 통해 AI 에이전트(Cursor, Claude 등)가 라이브 문서를 탐색하고 백엔드 메서드를 직접 실행할 수 있습니다.

### 4. Zero-Allocation 고성능

극한의 효율성을 위해 설계되었습니다. 기존 업계 방식 대비 **메모리 할당 60~100% 감소**, **JS 파싱 속도 250% 향상**.

---

## ⚡ 두 단어. 모든 언어.

DeukPack v1.7.6는 **범용 2-Method 직렬화 API**를 도입합니다: **`Pack`** 과 **`Unpack`**.  
언어와 포맷(Binary, JSON, Zero-Alloc)에 상관없이 두 동사만 기억하면 됩니다.

```
Pack    → 직렬화 (데이터 출력)
Unpack  → 역직렬화 (데이터 입력)
```

**format 매개변수**로 프로토콜을 전환하고, **기존 인스턴스**에 `Unpack`을 호출하면 Zero-Alloc 덮어쓰기가 됩니다.  
이것이 전체 API 표면입니다.

> [!CAUTION]
> **Unity / C# 사용자 주의 (Zero-Alloc 방어):**
> 매 프레임 수신되는 패킷(Hotpath) 처리 시 절대 `var h = Hero.Unpack(bin);` (Factory 방식)을 사용하지 마세요. 내부적으로 은밀하게 `new` 연산을 유발해 가비지 수집(GC) 스파이크와 심각한 프레임 렉을 발생시킵니다.
> **반드시** 게임 시작 시 미리 할당(new)해 둔 객체를 이용해 데이터를 덮어쓰는 **`Hero.Unpack(cachedHero, bin);`** 방식을 사용해야 프레임 드랍이 없는 완벽한 Zero-Allocation 아키텍처가 달성됩니다.

```csharp
// C# / Unity: 1.Create  2.Pack  3.Unpack (Zero-Alloc)
var hero = new Dto.Hero { id = 1, name = "Deuk" };
byte[] bin = Dto.Hero.Pack(hero);          // Serialize (Static)
Dto.Hero.Unpack(hero, bin);                // Zero-Alloc (Static-Update)
```

```typescript
// TypeScript / JavaScript: 1.Create  2.Pack  3.Unpack (No Class Wrappers)
const hero = Dto.Hero.create({ id: 1, name: "Deuk" });
const bin = Dto.Hero.pack(hero);           // Serialize
Dto.Hero.unpack(hero, bin);                // In-place Update
```

```cpp
// C++ (Native): 1.Create  2.Pack  3.Unpack (Memory Safe)
Dto::Hero hero; hero.id = 1; hero.name = "Deuk";
auto bin = Dto::Hero::Pack(hero);          // Serialize
Dto::Hero::Unpack(hero, bin);              // Zero-Alloc Deserialize
```

```java
// Java: 1.Create  2.Pack  3.Unpack (High-Performance)
Dto.Hero hero = new Dto.Hero(1, "Deuk");
byte[] bin = Dto.Hero.pack(hero);          // Serialize (Static)
Dto.Hero.unpack(hero, bin);                // In-place Overwrite (Static)
```

```elixir
# Elixir: 1.Create  2.Pack  3.Unpack (BEAM Native)
hero = %Dto.Hero{id: 1, name: "Deuk"}      # Immutable Struct
bin = Dto.Hero.pack(hero)                  # Serialize
hero_parsed = Dto.Hero.unpack(bin)         # BEAM Pattern Match
```


---

### 🚀 Quick Start

```bash
npx deukpack init
```

**1. 스키마 정의 (또는 OpenAPI / Protobuf 임포트)**

```deuk
namespace Dto

struct Hero {
    1> int32 id
    2> string name
    3> float hp
}
```


---

### 🔄 하위 호환성 — 기존 코드는 그대로 작동합니다

모든 **레거시 메서드명은 deprecated alias로 보존**됩니다. Breaking Change 없음.

| 구 API (여전히 작동) | 새 등가 API |
| :--- | :--- |
| `Hero.toBinary(obj)` | `Hero.pack(obj)` |
| `Hero.toJson(obj)` | `Hero.pack(obj, 'json')` |
| `Hero.fromBinary(buf)` | `Hero.unpack(buf)` |
| `Hero.fromJson(str)` | `Hero.unpack(str, 'json')` |
| `Hero.unpackInto(obj, buf)` | `Hero.unpack(obj, buf)` |
| `DeukPackCodec.UnpackInto(obj, data)` | `obj.Unpack(data)` *(C#)* |

기존 코드는 컴파일 에러 없이 그대로 동작합니다. IDE는 deprecated 메서드에 밑줄을 그어 `Pack/Unpack`으로 마이그레이션을 부드럽게 유도합니다.

---

### 🎮 실전 패턴: Unity 게임 클라이언트 (Zero-Alloc)

```csharp
Dto.Hero cachedHero = new Dto.Hero(); // 시작 시 딱 한 번만 할당

void OnNetworkMessage(byte[] inputData) {
    // Zero-Garbage 역직렬화 — 신규 객체(Class) 할당 없음!
    cachedHero.Unpack(inputData);
    Debug.Log($"Hero: {cachedHero.name}, HP: {cachedHero.hp}");

    // 값 변경 후 재직렬화 (주의: byte[] 버퍼 재사용은 Stream API 사용)
    cachedHero.hp -= 10f;
    byte[] outputData = Dto.Hero.Pack(cachedHero);
    network.Send(outputData);
}
```

---


## 🚀 릴리즈 로드맵

| 버전 | 주요 마일스톤 | 상태 |
| :--- | :--- | :--- |
| **v1.4.0** | MCP Protobuf 확장, C#/C++/JS 코어 런타임 안정화 | **완료** |
| **v1.5.0** | **Java & 코어 패리티**: 상속, Compact/TJSON, MCP 분리 | **완료** |
| **v1.5.1** | **C++ Zero-Alloc 최적화**: Arena 할당자, C++ DDL 생성기 | **완료** |
| **v1.6.0** | **V8 JIT Codegen & Zero-Alloc**: JS/C# 메모리 최적화 | **완료** |
| **v1.7.0** | **Elixir 엔진 지원**: 네이티브 BEAM 패턴 매칭 & 보안 방어 | **완료** |
| **v1.8.0** | **통합 2-Method API**: 6개 언어 전체 `Pack`/`Unpack` 표준화 | **완료** |
| **v1.8.1** | **Dialyzer & CI 파이프라인 무결화**: 순정 `sample.deuk` 환경 마이그레이션 | **현재** |

---



| 환경 | 지표 | 서드파티 태그 기반 | 서드파티 RPC 기반 | **DeukPack** |
| :--- | :--- | :---: | :---: | :---: |
| **C# / Unity** | 속도 | ~ 45 ms | ~ 85 ms | ~ **28 ms** |
| | 메모리 | +4.5 MB | +12.0 MB | **0 MB (Zero)** |
| **C++ (Native)** | 속도 | ~ 14 ms | ~ 22 ms | ~ **12 ms** |
| | 메모리 | 힙 할당 | 힙 할당 | **수동 풀** |
| **Java (Backend)** | 속도 | ~ 25 ms | ~ 38 ms | ~ **35 ms** |
| | 메모리 | 지속적 | 대형 객체 | **+2.1 MB (최소)** |
| **JavaScript (V8)** | 속도 | ~ 54 ms | ~ 190 ms | ~ **158 ms** |
| | 메모리 | +4.2 MB | -1.9 MB | **즉시 회수** |
| **Elixir (BEAM)** | 속도 | - | - | ~ **31 ms** |
| | 메모리 | - | - | **0 MB (네이티브 매칭)** |

> 10,000행 페이로드 디코딩 기준. 환경에 따라 결과가 다를 수 있습니다.

---

## 피처 매트릭스

| 카테고리 | 피처 | TS / JS | C# / Unity | C++ | Java | Elixir |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **IDL 코어** | 기본 타입 / 별칭 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **상속** | `extends` 지원 | ✅ | ✅ | ✅ | ✅ (v1.5) | ✅ |
| **통합 API** | `Pack` / `Unpack` (2-method) | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 | ✅ v1.8.0 |
| **프로토콜** | Native Pack (.dpk) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Protobuf 호환 | ✅ | ✅ | ✅ | ✅ | - |
| | Thrift 호환 (T-Series) | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| | JSON (Tagged / POJO) | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| **최적화** | Zero-Alloc / JIT | ✅ (v1.6) | ✅ | ✅ (v1.4.2) | 🚧 | ✅ (BEAM) |
| **AI 통합** | MCP 툴 자동 생성 | ✅ (v1.5) | 🚧 | - | - | - |
| | IDE IntelliSense | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 설치

```bash
npm install deukpack
npx deukpack init
npx deukpack run
```

튜토리얼: **[deukpack.app/ko/tutorial](https://deukpack.app/ko/tutorial/)**.

---

## 🛡️ 보안 & 신뢰성 (OOM 방어 / Anti-DDoS)

- **범용 OOM 방어 (v1.7.0+)**: 모든 엔진에 `MAX_SAFE_LENGTH`(10MB), `MAX_ELEMENT_COUNT`(100만) 절대 검증 경계 적용. 메모리 할당 전 악성 패킷 즉시 폐기(Fail-Fast).
- **점진적 청크 검증**: 레거시 `ReadToEnd()` 방식을 완전히 대체. JSON 스택 폭발 공격 무력화.
- **지속적 DDoS 퍼저 스위트**: CI 통합 `test-fuzz-oom.js`로 2GB+ 비정상 버퍼 및 무한 트리 구조에 대한 내성 검증.

---

## 문서 및 링크

| 종류 | 링크 |
| :--- | :--- |
| **이 README** | 클론 시 요약 |
| **기능 개요** | [DEUKPACK_FEATURES.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_FEATURES.ko.md) |
| **[deukpack.app](https://deukpack.app/ko/)** | 설치, 튜토리얼, [API 레퍼런스](https://deukpack.app/ko/reference/api/) |
| **영문 README** | [README.md](README.md) |
| **릴리즈** | [RELEASING.ko.md](RELEASING.ko.md) |

**연락처:** contact@deukpack.app

---

## 개발

```bash
npm ci
npm run build
npm test
```

---

## ☕ 지원 & 연락처

DeukPack은 완전한 오픈소스(Apache 2.0)입니다. 30년 서버 아키텍처 경험에서 발견한 Zero-Allocation 및 동기화 문제를 해결하기 위해 만들었습니다.

- 📩 **연락 / 기술 문의**: joygram@gmail.com
- ☕ **프로젝트 후원**: [Ko-fi](https://ko-fi.com/joygram)

**저장소 스타**나 Protobuf/Thrift를 다루는 팀과 공유해 주시면 큰 힘이 됩니다.

---

## 함께 쓰면 좋은 (Deuk Family)

**스펙으로 더 많은 일을 하고 싶다면?** **DeukPack** — IDL 입력, 결정론적 타입과 직렬화 출력.  
**에이전트가 저장소에서 예측 가능하게 동작하길 원한다면?** **[DeukAgentRules](https://github.com/joygram/DeukAgentRules)**

```bash
npm install -D deuk-agent-rule
npx deuk-agent-rule init --non-interactive
```

---

## 기여

1. Fork → feature 브랜치 → PR.
2. 릴리즈 구조: [RELEASING.ko.md](RELEASING.ko.md)

---

## 라이선스

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE).

---

## 감사의 말

IDL / OpenAPI / schema 커뮤니티 전체에 감사드립니다. DeukPack은 **독자적인 파이프라인**으로 Apache Thrift 서브프로젝트가 아닙니다.