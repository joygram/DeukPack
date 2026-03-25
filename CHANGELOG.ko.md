# 변경 이력 (Changelog)

득팩 npm 패키지(`deukpack`) **릴리스별 변경 요약**입니다.

**English:** [CHANGELOG.md](CHANGELOG.md)

---

## [1.2.8] — 2026-03-25

### 변경

- **와이어 프로토콜 네이밍**: **`tproto`** 를 **`protv2`** / **`protv3`** 로 변경(타입·직렬화·테스트·문서). `t-` 접두어는 Thrift 전용(`tbinary`/`tcompact`/`tjson`), `proto-` 접두어는 Protobuf 에디션(proto2/proto3) 구분.

---

## [1.2.7] — 2026-03-25

### 변경

- **C# (`DeukPack.Protocol`)**: **`DpFormat`** enum을 **`DpProtocolCore`** 에 통합 — `Binary`, `Json`, `DeukJson`, `DeukYaml`(별칭 `Yaml`). **`DpDeukYamlProtocol`** 추가.
- **C++**: **`DpProtocol.h`** 템플릿 추가; primitive 코드젠 타입을 `deuk::*` 별칭으로 매핑.

---

## [1.2.6] — 2026-03-28

### 변경

- **스키마·임베디드 메타**: 필드·루트 스키마의 **`type` 문자열**을 **득팩 표준**(`struct`, `enum`, `int16`/`int32`/`int64` 등)으로 통일. **C#** `DpSchemaType`은 **`Int16`/`Int32`/`Int64`** 및 **`SchemaTypeToStandardString`**. **JSON 호환 와이어** 객체 키(`i32`, `tf`, `str`, `lst` 등)는 **변경 없음**.
- **C# 코드젠**: **`string`**·구조체 참조 필드 기본 초기화로 **`nullable` 활성** 소비 프로젝트 경고 감소; 코드젠 nullable 모드 꺼짐 시 선택적 구조체 **`Clone()`** 에 null-forgiving 경로.
- **CI**: **C++** 네이티브 와이어 라이브러리 **빌드 + `ctest`** 를 **Ubuntu·Windows** 러너에서 실행.
- **도구**: **`npm run verify`** 로 **GitHub Actions** 와 동일한 검증을 로컬에서 실행.

---

## [1.2.5] — 2026-03-27

### 변경

- **패키지 exports (`index`)**: npm에 올라가는 **`serialize` / `deserialize`**, 인터롭, **`packStructWire`** 등 공개 API가 **GitHub** 쪽 TypeScript 진입점과 맞춰짐. Excel 전용 프로토콜은 공개 소스 트리 밖에만 존재.
- **C# (`DeukPack.Protocol`)**: **`DpProtocol`** 과 맞추기 위해 **`WriteString` / `WriteBinary`** 를 **`string?` / `byte[]?`** 로 정리(CS8767). **`DpMetaInfosWrapper<T>.TryGetValue`** 에 **`[MaybeNullWhen(false)]`** 적용.

---

## [1.2.4] — 2026-03-26

### 변경

- **README (GitHub)**: **GitHub** 에서 쓰는 영문·국문 README 에서 문서 링크를 **[deukpack.app](https://deukpack.app/)** 로 안내하도록 정리.
- **의존성·툴체인**: **`nan`**, **`node-addon-api` ^8**, **`yaml`**; dev — **Jest 30**, **`protobufjs` ^8**, **`rimraf` ^6**, **`cmake-js` ^8**, **`node-gyp` ^12**, **`@vscode/vsce`**, **`@types/jest` ^30**, **`typescript` ^5.9**, **`@types/node` ^20.19**; **`engines.node` ≥18**; **`scripts/setup.js`** 최소 **Node 18**.
- **보안**: **`npm audit fix`** — 전이 **`minimatch`** high ReDoS 권고 대응.

---

## [1.2.3] — 2026-03-25

### 변경

- **`deukpack init`**: 대화형 질문 정리(디렉터리 전체 IDL만; exclude/include 전략 질문 제거); **bootstrap**(**`.deukpack/workspace.json`**) 항상 실행; **`--skip-workspace` 제거**.
- **VSIX**: 워크스페이스 bootstrap **이후** 실행; 자동 설치 순서 **`code` → `cursor` → `antigravity`**(`--install-extension`).
- **문서**: README **`npx`** / **`npm deukpack`** 구분; init 순서·postinstall 문구 정리.

---

## [1.2.2] — 2026-03-24

### 추가

- **파이프라인**: **`thriftFile` 생략 시** **`defineScope: "all"`** — **`defineRoot` 아래 모든 `*.deuk`**를 모아 **`exclude`**(전역+잡 병합) 적용 후 **임시 번들 엔트리**로 빌드; 번들 파일은 잡 종료 시 삭제.
- **`outputLangSubdirs`**: 잡별 선택 **`{ csharp?, cpp?, ts?, js? }`** — 각 값은 **`outputDir` 아래 **한 단계** 폴더명(구 레이아웃은 **`typescript`** / **`javascript`** 등).

### 변경

- **호환 깨짐(생성 경로)**: **`--ts`** / **`--js`**(파이프라인 **`ts`** / **`js`**) 산출이 **`typescript/`**, **`javascript/`** 대신 **`<out>/ts/`**, **`<out>/js/`** 로 바뀜.
- **파이프라인**: **`jobs[].outputDir` 생략** 시 **`defineRoot`** 와 동일한 상대 경로(기본 **`idls`**)가 출력 루트 → **`csharp`/`cpp`/`ts`/`js`** 하위에 생성.
- **`deukpack init`**: 기본 생성 파이프라인이 **`defineScope: "all"`**, **`outputDir` = `defineRoot`** 에 맞춤; 대화형 기본값 정리.
- **문서·예제·키트**: **`ts`/`js`** 출력 경로 반영.

---

## [1.2.1] — 2026-03-24

### 변경

- **문서**: **README** / **README.ko** — 설치 절차를 **코드 블록**으로 정리; **프로젝트 로컬** `npm install deukpack` → `npx deukpack init` → `npx deukpack run`; 이 README에서는 **`npm install -g` 전역 설치** 안내 제거; 키트 링크 표기 **득팩 테일** / 영문 **DeukPack Tale**(URL은 `/journey/` 유지).
- **CLI**: 단발 `deukpack <엔트리> <출력> …` 시 **`./deukpack.pipeline.json`**이 없으면 **경고** 후 **`npx deukpack init`** 권장(생성은 계속 진행).
- **`deukpack init` / bootstrap / 동봉 VSIX**: **`.deukpack/deuk-idl-vsix.json`**의 **npm `deukpack` 버전**과 불일치하면 **질문 없이** 동봉 VSIX 설치 시도; **Unity 프로젝트 근처** 감지 시 안내·거절 경고 강화; **`--non-interactive` `init`**은 **`--skip-vsix`가 아니면** 버전 갱신 VSIX **ensure** 실행; **bootstrap**은 VSIX 프롬프트에 Unity 힌트 전달, 비-TTY일 때 bump **ensure** 실행.

---

## [1.2.0] — 2026-03-23

### 추가

- **동봉 VS Code 확장**: npm tarball에 **`bundled/deuk-idl.vsix`** 포함. **postinstall**은 **`.deukpack/deuk-idl-vsix.json`**에 기록된 **`deukpack` npm 버전**과 달라지면 다시 **`code` / `cursor` / `antigravity --install-extension`** 시도. **대화형 `deukpack bootstrap`** 마지막에 VSIX 설치·갱신 확인. **`bundled/README.md`** 참고.
- **Unity**: **[deukpack.app](https://deukpack.app/)** 에 **DeukPack.Protocol** 등을 UPM 스타일로 넣는 방법이 정리됨. 네이티브 플러그인은 게임/프로젝트 빌드로 만들며, npm **`deukpack`** tarball 안에는 포함되지 않음.
- **npm 와이어 진입(단일 형태)**: **`serialize(값, 프로토콜?, extras?)`** / **`deserialize(데이터, 프로토콜?, extras?)`** —보내는 타입 **`WireExtras`** / **`WireDeserializeExtras`**(`pretty`, `interopRootStruct`, `interopStructDefs`, `targetType` 등). 세부 제어는 **`WireSerializer`/`WireDeserializer`** + **`SerializationOptions`** 유지.

### 변경

- **호환 깨짐(JS 패키지 진입)**: `serialize(_, 프로토콜, pretty불리언, wireFamily)` 제거 → **`serialize(_, 프로토콜, { pretty: true, wireFamily?, … })`**. **`deserialize`**는 **`string` | `Uint8Array` | `Buffer`** 허용, 세 번째 인자는 **`WireExtras`** 형태 + 선택 **`targetType`**.
- **와이어(TypeScript)**: **`BinaryReader`**, **`wireTags`**, **`SerializationWarnings`** 추가·보강; **`WireSerializer`/`WireDeserializer`** 확장으로 **득팩 네이티브**(`pack`·`json`·`yaml`)와 **인터롭**(`tbinary`·`tcompact`·`tjson`+스키마) 짝 유지. **C# `DeukPack.Protocol`**: csproj·**SharedCompile** props 정리.
- **CI**: GitHub Actions에 **setup-dotnet** 적용 → `DeukPack.Protocol` 등 C# 빌드 안정화; 단계명 YAML 따옴표(`:`·`&`) 수정.
- **코드 생성**: C++/TS/JS 출력 **템플릿화** 정리; JS/스키마 **득팩 표기** 정합.
- **문서**: DeukNavigation **게임 연동**(베이킹·런타임) 보강; **deukpack.app** 갱신.
- **저장소**: ExcelProtocol·예제 **빌드 산출물** gitignore·추적 해제.

---

## [1.1.0] — 2026-03-20

### 추가

- **C++ 코드 생성 (`--cpp`)**: `uint8`·`uint16`·`uint32`·`uint64` → `<cstdint>`의 `uint8_t` / `uint16_t` / `uint32_t` / `uint64_t` 매핑. 생성 헤더에 `#include <cstdint>` 추가.
- **IDL 파서**: Thrift 스타일 **레거시 `message` 블록**(괄호 숫자 ID 없이 `message Name { ... }`) 파싱 — 기존 `.thrift`·혼합 워크플로 호환. (`declarationKind`는 `message`)

### 수정

- **C# 런타임(DeukPack.Protocol)**: Binary 관련 enum·`IDisposable` 등 생성/런타임 정합.
- **CLI**: `bin/deukpack.js` → `scripts/build_deukpack.js` 위임(cwd 독립).

### 변경

- **문서·사이트**: README 한 줄 요약·[deukpack.app](https://deukpack.app/) 레퍼런스 구조(서브모듈 커밋에 맞춰 갱신).

### 검증 — DeukPackKits 스타터키트 (로컬 CLI `1.1.0`)

**2026-03-23** 이 저장소에서 `npm run build` 후 `node scripts/build_deukpack.js` 로 확인:

| 키트 경로 | 명령 | 결과 |
|-----------|------|------|
| `DeukPackKits/StarterKit/csharp/prologue` | `idls/csharp.deuk` → 출력, `-I idls --csharp` | 성공 — `csharp.cs`, `MetaTableRegistry.g.cs`, `DeukDefine.csproj` 생성 |
| `DeukPackKits/StarterKit/cpp/prologue` | `idls/cpp.deuk` → 출력, `-I idls --cpp` | 성공 — `cpp_deuk.h` / `cpp_deuk.cpp` 생성(수동 헤더와 충돌 완화 접미사), 헤더에 `<cstdint>` 포함 |

*(다른 `StarterKit/` 방은 이번에 전수 실행하지 않음. 각 README의 명령을 따르면 됩니다.)*

---

## [1.0.x] — 2026-03 경 (패치 라인)

### 요약

- 초기 **1.0.x** 패치는 **버그 수정·패키징·C# 멀티 타깃·문서 경로** 중심이며, 코어 기능 범위를 넓히지 않음.

---

이 파일 이전 커밋 내역은 `git log`·GitHub **Releases** 참고.
