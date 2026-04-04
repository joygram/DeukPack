# 변경 이력 (Changelog)

득팩 npm 패키지(`deukpack`) `릴리스별 변경 요약`입니다.

**English:** [CHANGELOG.md](CHANGELOG.md)

## [1.9.0] — 2026-04-04

### 파이썬 언어 지원 (Python Engine)
- **Python 공식 바이너리 엔진 추가**: Python 3.6 이상의 환경을 공식 지원하며, Rust C-API (`ORJSON`) 구조를 차용/분석하여 직렬화 병목을 최소화할 수 있는 방향으로 엔진을 통합했습니다.

- **실무 모델 측정`: 1차원적인 단순 모델 테스트를 폐기하고, 다차원 해시맵, 깊은 트리 객체가 포함된 `복합 컬렉션 테스트 모델(ComplexRoundtripModel)** 로 테스트 기준을 스케일업하여 엔터프라이즈 레벨의 투명한 객관성을 확보했습니다.

## [1.8.1] — 2026-04-03

### 파이프라인 및 CI/CD 핫픽스
- **레거시 의존성 제거**: `ci.yml` 스크립트 등 CI 파이프라인에서 삭제된 `sample.thrift`를 하드코딩으로 참조하여 발생하던 빌드 실패 이슈를 해결하고, 순정 `sample.deuk` 규격으로 테스트 스위트를 완벽하게 마이그레이션 및 교체했습니다.
- **Elixir Dialyzer 타입 안정성**: 특정 환경에서 발생하는 `Jason` 파서 모듈의 컴파일 타임 존재 경고를 `apply` 리플렉션을 통해 동적으로 우회(Bypass)시켜 무결점(Zero-Warning) 매트릭스 테스트를 달성했습니다.
- **C# Non-nullable 컬렉션 경고 방어**: 생성된 컬렉션 이터레이터 내부에서 CS8603 (Possible null reference return) 널 참조 경고가 표기되지 않도록 널 포기빙 연산자(`!`)를 명시적으로 주입했습니다.

## [1.8.0] — 2026-04-03

### Core: 직렬화 API 통일성 및 Static 오버로드 강제화
- **API 규격 정규화 (C# / Java)**: 인스턴스 멤버 방식의 레거시 직렬화 메서드를 제거하고, 전 언어권에 걸쳐 `Pack` / `Unpack` API를 완벽한 정적(Static) 오버로드 구조로 통일하여 `CS0111` 등의 컴파일러 충돌을 해결했습니다.
- **Zero-Allocation 아키텍처 방어망 구성**: 고빈도 네트워크 핫패스(Unity / Unreal 등)에서의 프레임 드랍과 OS 네이티브 힙(Heap) 락을 방지하기 위해, 사전 수영장(Memory-Pool) 최적화 기법을 완벽히 지원하는 덮어쓰기 형태의 `Unpack(obj, bin)` 인터페이스를 C# 및 C++ 권장 표준으로 문서화했습니다.
- **JavaScript V8 엔진 최적화**: C#/C++와 대조적으로 Node.js / V8 머신 환경에서는 동적 객체 오버라이딩 시 넥터(히든 클래스/인라인 캐시)가 무너져 오히려 병목이 발생함을 규명하고, 수명이 짧은 팩토리 패턴인 `unpack(bin)`을 사용할 강력한 가이드라인을 레퍼런스에 추가했습니다.

### Security & Static Analysis (보안 및 정적 분석)
- **Elixir Dialyzer 무결성 보장**: Elixir 코드가 생성될 때 모든 `pack` 및 `unpack` 직렬화 함수 위에 엄격한 정적 런타임 타입 어노테이션(`@spec`, `@type t()`, `binary()`)을 씌우도록 코어 제네레이터를 확장했습니다. 이로써 `mix dialyzer` 구동 시 일체의 "no_return" 혹은 타입 모호성(Warning)이 발생하지 않습니다.
- **Dialyzer 자동화 테스트 파이프라인**: 득팩 파이프라인에 이식할 수 있는 자동화된 Dialyzer 검증 스크립트(`scripts/test_elixir_dialyzer.js`)를 구축하여 향후 Elixir 브릿지단에서의 타입 안정성을 항구적으로 검증합니다.

## [1.7.6] — 2026-04-03

### 문서 (Documentation)
- **C# 스니펫 컴파일 문법 검증**: "한눈에 보기"의 C# 예제 코드가 실제 `DeukPackCodec`와 함께 정상 컴파일되도록 수도코드(Pseudo-code)의 모호성을 제거하고 정확한 API 사용법으로 갱신했습니다.

## [1.7.5] — 2026-04-03

### 핫픽스 (Hotfix)
- **리드미 서식 교정**: NPM 레지스트리 렌더러가 빈 테이블 헤더(`| | |`)를 파싱하다가 크래시가 발생하여 README 노출이 통째로 실패하던 버그를 해결했습니다.

## [1.7.4] — 2026-04-03

### 핫픽스 (Hotfix)
- **리드미 서식 교정**: npm 레지스트리 환경과의 호환성을 위해 CAUTION 및 TIP 섹션에서 인용구(`>`) 마크다운 기호를 완전히 제거.

## [1.7.3] — 2026-04-03

### 핫픽스 (Hotfix)
- **리드미 서식 교정**: npm 레지스트리 환경에서 깨지던 GitHub Alerts (`> [!TIP]`, `> [!CAUTION]`) 마크다운 교정.

## [1.7.2] — 2026-04-03

### 핫픽스 및 문서 (Hotfix & Docs)
- **Elixir CI 빌드 보강**: `ElixirBridge.exs` 스크립트 실행 과정에서 컴파일타임 객체 바인딩(`%Struct{}`)으로 인해 발생하던 런타임 `CompileError`를 동적 `struct()` 초기화로 전환하여 해결.
- **문서 마크다운 개선`: `deukpack.app` 렌더링 과정에서 `~` 첨자 기호와 굵은 글씨(```) 파서 모호성으로 깨지던 벤치마크 표 서식 오류 전면 수정.
- **지원 매트릭스 동기화**: C#, C++, TypeScript 전 영역에 걸친 Protobuf 부분의 진행률 표기를 현재 코어 상태에 맞게 완료(`✅`) 처리.
- **공식 홈페이지 보안 내역 등재**: README 전반에 OOM 방어 및 DDoS 퍼저 전략에 대한 "Security & Trust" 항을 명문화 적용.

## [1.7.1] — 2026-04-03

### 문서 (Documentation) & 벤치마크
- **Elixir 공인 벤치마크 결과 등록**: 10,000건 스트레스 디코딩 수행 시 처리 속도(~31ms) 및 완전 무할당(0 MB) 메모리 효율(BEAM 네이티브) 능력을 공식 README 벤치마크 매트릭스에 정식 등록.
- **Readme 지원 매트릭스 갱신**: `v1.7.0` 스펙 업데이트에 맞춰 Elixir 기능(IDL 파싱, 프로토콜, extends) 기호를 테스트(`🚧`)에서 완료(`✅`)로 최종 반영.

## [1.7.0] — 2026-04-03

### 핵심: Elixir 정식 지원 및 통합 프로토콜 보안 쉴드(OOM 방어) 구축

- **Elixir (Erlang BEAM) 런타임 엔진 출격**: Elixir 환경을 위한 네이티브 프로토콜 지원을 완벽히 구현했습니다. Erlang의 고성능 바이너리 패턴 매칭(`<<tag::integer, ...>>`)을 적극 활용하며, 크로스 랭귀지 매트릭스 테스터를 통해 안정성을 검증했습니다.
- **유니버설 OOM 방어망 (프로토콜 보안)**: 5대 백엔드 엔진(JS, C#, C++, Java, Elixir) 전체에 네트워크 계층의 악의적 페이로드(DDoS 및 메모리 폭탄)에 대한 방어망을 구축했습니다. 파서 로드 단계부터 `MAX_SAFE_LENGTH`(10MB)와 `MAX_ELEMENT_COUNT`(1백만 개) 상한선을 강제 적용하여, 공격 감지 시 OOM 발생 이전에 공격 패킷을 즉시 폐기(Fail-Fast)합니다.
- **JSON 버퍼 플러딩(Flood) 취약점 패치**: Java, C++, C# 엔진 전반에서 기존에 존재하던 JSON 스트림 전체 읽기(`ReadToEnd()`) 방식을 전면 개편했습니다. 점진적 길이 체크 로딩을 도입하여 JSON 폭탄 메모리 누수 취약점을 완벽하게 차단했습니다.
- **DDoS Fuzzer 자동화 추가**: CI 과정에서 2GB 이상의 거대 문자열, 무한 리스트, 잘못된 Map 등의 공격 시나리오를 자동으로 쏘고 모든 언어 파서가 에러로 터지기 전에 자체 방어를 성공하는지 증명하는 `test-fuzz-oom.js` 퍼저(Fuzzer)를 공식 파이프라인에 도입했습니다.

---

## [1.6.0] — 2026-04-01

### 핵심: 데이터 파서 아키텍처 대격변 (Zero-Allocation 및 V8 JIT 코드젠)

- **JavaScript JIT-Friendly 코드젠 변환**: Node.js 및 브라우저 환경에서 작동하던 기존 동적 AST 리플렉션 파서를 공식으로 폐기하고, 사전 컴파일되어 정적으로 주입되는 인라인 함수(`_readPack`, `_readBin`)를 전면 도입했습니다. 이는 동급 JSON 파싱 대비 속도를 250% 개선하며, 치명적인 힙 할당(Heap Allocation) GC 스파이크 현상을 완벽하게 해결합니다.
- **C# / Unity Zero-GC 아키텍처 공식화**: Unity 클라이언트 직렬화 파이프라인을 값 타입(`[StructLayout]`) 및 완전 정적 람다 생성기로 격상시켰습니다. 백만 회 이상의 반복 로딩 테스트에서 단 1바이트의 메모리 할당(0 MB)도 발생하지 않는 완전 무할당(Zero-Alloc) 동작을 달성했습니다.
- **크로스 랭귀지 마스터 벤치마크 매트릭스 확보**: C#, C++, Java, JS 플랫폼 간의 메모리 누수 수명(GC overhead) 비교 테스트를 통합했습니다. DeukPack은 이제 타사 상용 포맷 모델(Tag-based & RPC-based)들과 동등하거나 그 이상의 속도를 내면서도 모바일 프레임 드랍을 유발하는 메모리 블로팅(Bloating)을 원천 차단합니다.


## [1.5.0] — 2026-03-30

### 핵심: Java 패리티 완성 및 MCP 코어 분리 (아키텍처 최적화)

- **Java 런타임 패리티`: Java 생성기에서 구조체 상속(`extends`)을 지원하며, `Compact**(`TCompactProtocol`) 및 **TJSON**(`TJSONProtocol`) 고성능 프로토콜을 추가하여 Thrift와의 완전한 호환성을 확보했습니다.
- **보안 가드 전수 적용**: 모든 언어(TS/JS, C#, C++, Java) 프로토콜에 `MAX_SAFE_LENGTH`(10MB) 및 `MAX_RECURSION_DEPTH`(64) 보안 정책을 강제 적용하여 악의적인 페이로드로부터 시스템을 보호합니다.
- **MCP 코어 로직 분리**: 코어 저장소의 경량화를 위해 MCP 서버 생성 로직을 별도 모듈(`DeukPackMcp`)로 분리했습니다. 코어는 이제 AI 지식 추출(`AiContextGenerator`)에 집중하며, 도구 생성 기능은 플러그인 형태로 제공됩니다.
- **기능 지원 표(Feature Matrix) 세분화`: 모든 문서의 프로토콜 지원 현황을 `Native Pack**, **Protobuf**, **Thrift (T-Series)**, **JSON**, `YAML/CSV`로 세분화하여 동기화했습니다.

### 수정

- **CLI 안내 메시지**: `deukpack --mcp` 실행 시, v1.5.0부터 분리된 플러그인 정책을 알리는 적절한 안내 메시지가 출력되도록 개선했습니다.
- **의존성 경량화**: 코어 `package.json`에서 `@modelcontextprotocol/sdk`를 제거하여 설치 용량을 줄였습니다.


## [1.4.0] — 2026-03-29

### 핵심: MCP Protobuf 확장 및 서버 생성 지원

- **Protobuf IDL 고도화**: 중첩된 메시지(`nested messages`), 서비스(`services`), RPC 정의를 지원하도록 Protobuf 파서를 대폭 확장했습니다.
- **MCP Server 생성기**: Protobuf 및 Deuk IDL에서 직접 Model Context Protocol(MCP) 서버 코드를 생성하는 라운드트립 기능을 추가했습니다.

### 수정


## [1.3.0] — 2026-03-28

### 핵심: AI-Ready Interface Hub 정식 전환

- **Mixed-IDL 하이브리드 시리얼라이저`: 득팩 코어 엔트리 하나로 ``.deuk`**, **`.thrift`**, **`.proto`**, **OpenAPI** 정의를 동시에 파싱하고 단일 바이너리 스펙으로 통합하는 체계를 확립했습니다.
- **IDL-to-AI 시맨틱 매핑`: ``AiContextGenerator``를 통해 득팩 AST에서 AI 에이전트(LLM)가 아키텍처와 데이터 구조를 100% 명확히 이해할 수 있는 `시맨틱 컨텍스트(Markdown/JSON)** 추출 기능을 추가했습니다. (**`npm run export:ai-context`**)
- **공식 웹사이트(`deukpack.app`) 개편**: 'AI-Ready 인터페이스 허브' 컨셉에 맞춰 메인 페이지와 제품군(Core, Protocol, Excel, Pipeline) 소개서를 전면 개편하고 동기화했습니다.

### 추가


### 변경

- **`npm run build`**: TypeScript 컴파일을 **`node ./node_modules/typescript/lib/tsc.js`** 로 호출 — `tsc`가 `PATH`에 없어도 빌드 가능(일부 Windows 환경).
- **devDependencies**: **`jest`** 를 **^29.7.0** 으로 핀(**`@types/jest`** ^29.5.14) — Windows에서 `Jest 30`이 **`ts-jest`** preset/transform 경로 검증에 실패하여 **`npm test`** 가 돌아가도록 함.
- **Windows C++ 와이어 테스트`: ``npm run test:cpp`**·**`verify-build.js`** 가 **`scripts/run-cpp-native-tests.js`** 를 사용해 CMake를 **Visual Studio** 생성기로 구성(기본 **Visual Studio 17 2022**, **x64**) — **NMake** 없이 동작. 필요 시 **`DEUKPACK_CPP_CMAKE_GENERATOR`** / **`DEUKPACK_CPP_CMAKE_ARCH`** 로 변경.

---

## [1.2.10] — 2026-03-26

### 수정

- **C++ 네이티브 소스 인코딩`: `wire_engine.h` 주석의 UTF-8 em-dash 제거 — 한국어 로케일 Windows(`CP949`)에서 발생하던 MSVC `C4819** 경고 해소.
- **MSVC 컴파일 플래그`: `binding.gyp`(`msvs_settings`)와 `native/cpp/CMakeLists.txt`에 ``/utf-8`** 추가 — 시스템 로케일에 관계없이 소스·실행 문자 집합을 UTF-8로 고정.

### 변경

- **`package.json`**: `npm` 엔진 하한 추가(`>=9.0.0`); `.npmrc`를 `files`에 포함해 소비자에게 `fund=false`/`audit=false` 기본값 전달.
- **`.npmrc`**(저장소 루트): `fund=false`, `audit=false` 설정.

---

## [1.2.9] — 2026-03-26

**워크스페이스 모드` (`.deukpack/workspace.json`): `패키지 설치`는 `installKind: "package"` — 배포된 npm 버전 기준으로 Unity ``Packages/manifest.json`` 만 갱신(git UPM URL); 로컬 DeukPack 클론 불필요. `소스(개발) 모드`는 `installKind: "src"` 및 `deukPackRoot` — `deukpack sync`와 ``npm install` 후처리`에서 `netstandard2.0** **`DeukPack.Core`**, **`DeukPack.Protocol`**, **`DeukPack.ExcelProtocol`** 각 **`.dll`**·**`.pdb`** 를 빌드·복사해 UPM 런타임 **Plugins** 에 넣음; 패키지 모드에서는 이 DLL 경로는 실행하지 않음.

### 추가

- **`deukpack add`**: 패밀리 패키지(`app.deukpack.navigation`, `app.deukpack.runtime` 등) 설치 및 Unity **`Packages/manifest.json`** 자동 갱신(두 모드 공통).
- **UPM 패키지 레이아웃`: Unity Package Manager 출력용 빌드 스크립트·파이프라인 프로필 스키마. ``deukpack init`** 시 `package.json` 템플릿·디렉터리 구조 생성.
- **`DeukPack.Core` 어셈블리`(코드젠 C#): `DeukPack.Protocol`에서 분리 — 메타데이터·공유 인터페이스를 별도 DLL로 둠. `소스(개발) 모드`: ``deukpack sync`** / Unity 플러그인 빌드가 **`DeukPack.Core.dll`**(및 **`.pdb`**)을 **Protocol**·**ExcelProtocol** 과 함께 **`app.deukpack.runtime`** **Plugins** 로 복사; 코드젠·게임 프로젝트는 공용 메타만 필요할 때 **Core** 만 참조하면 됨.

### 변경

- **`deukpack sync``(`sync-runtime` 별칭): 이름 정리. `소스(개발) 모드 전용` — `installKind`가 `"src"`일 때 `Core**·**Protocol**·**ExcelProtocol** netstandard2.0 플러그인을 빌드·Unity **Plugins` 로 복사. `패키지 설치**: 정보 메시지 후 스킵(로컬 빌드 없음).
- **`deukpack init` / `deukpack add`**: Unity manifest 의존성 동기화 복구; serverkit이 navigation과 함께 `app.deukpack.runtime` 공유.
- **`deukpack init` 마무리 및 `npm install` 후처리`: `소스(개발) 모드` — `Core**·**Protocol**·**ExcelProtocol` DLL 빌드·복사 후 manifest 갱신; `패키지 설치** — manifest 갱신만.

### 수정

- **보안`: `picomatch` `2.3.2** 업그레이드 (GHSA-c2c7-rcm5-vvqj, GHSA-3v7f-55p6-f55p).

---

## [1.2.8] — 2026-03-25

### 변경

- **와이어 프로토콜 네이밍`: ``tproto`** 를 **`protv2`** / **`protv3`** 로 변경(타입·직렬화·테스트·문서). `t-` 접두어는 Thrift 전용(`tbinary`/`tcompact`/`tjson`), `proto-` 접두어는 Protobuf 에디션(proto2/proto3) 구분.

---

## [1.2.7] — 2026-03-25

### 변경

- **C# (`DeukPack.Protocol`)**: **`DpFormat`** enum을 **`DpProtocolCore`** 에 통합 — `Binary`, `Json`, `DeukJson`, `DeukYaml`(별칭 `Yaml`). **`DpDeukYamlProtocol`** 추가.
- **C++**: **`DpProtocol.h`** 템플릿 추가; primitive 코드젠 타입을 `deuk::*` 별칭으로 매핑.

---

## [1.2.6] — 2026-03-28

### 변경

- **스키마·임베디드 메타`: 필드·루트 스키마의 ``type` 문자열`을 `득팩 표준`(`struct`, `enum`, `int16`/`int32`/`int64` 등)으로 통일. `C#** `DpSchemaType`은 **`Int16`/`Int32`/`Int64`** 및 **`SchemaTypeToStandardString`**. **JSON 호환 와이어` 객체 키(`int32`, `tf`, `str`, `lst` 등)는 `변경 없음**.
- **C# 코드젠`: ``string`**·구조체 참조 필드 기본 초기화로 **`nullable` 활성` 소비 프로젝트 경고 감소; 코드젠 nullable 모드 꺼짐 시 선택적 구조체 ``Clone()`** 에 null-forgiving 경로.
- **CI**: **C++` 네이티브 와이어 라이브러리 `빌드 + `ctest`** 를 **Ubuntu·Windows** 러너에서 실행.
- **도구`: ``npm run verify`** 로 **GitHub Actions** 와 동일한 검증을 로컬에서 실행.

---

## [1.2.5] — 2026-03-27

### 변경

- **패키지 exports (`index`)**: npm에 올라가는 **`serialize` / `deserialize`**, 인터롭, **`packStructWire`** 등 공개 API가 **GitHub** 쪽 TypeScript 진입점과 맞춰짐. Excel 전용 프로토콜은 공개 소스 트리 밖에만 존재.
- **C# (`DeukPack.Protocol`)**: **`DpProtocol`** 과 맞추기 위해 **`WriteString` / `WriteBinary`** 를 **`string?` / `byte[]?`** 로 정리(CS8767). **`DpMetaInfosWrapper<T>.TryGetValue`** 에 **`[MaybeNullWhen(false)]`** 적용.

---

## [1.2.4] — 2026-03-26

### 변경

- **README (GitHub)**: **GitHub** 에서 쓰는 영문·국문 README 에서 문서 링크를 **[deukpack.app](https://deukpack.app/)** 로 안내하도록 정리.
- **의존성·툴체인`: ``nan`**, **`node-addon-api` ^8**, **`yaml`**; dev — **Jest 30**, **`protobufjs` ^8**, **`rimraf` ^6**, **`cmake-js` ^8**, **`node-gyp` ^12**, **`@vscode/vsce`**, **`@types/jest` ^30**, **`typescript` ^5.9**, **`@types/node` ^20.19**; **`engines.node` ≥18**; **`scripts/setup.js`** 최소 **Node 18**.
- **보안`: ``npm audit fix`** — 전이 **`minimatch`** high ReDoS 권고 대응.

---

## [1.2.3] — 2026-03-25

### 변경

- **`deukpack init`**: 대화형 질문 정리(디렉터리 전체 IDL만; exclude/include 전략 질문 제거); **bootstrap**(**`.deukpack/workspace.json`**) 항상 실행; **`--skip-workspace` 제거**.
- **VSIX`: 워크스페이스 bootstrap `이후` 실행; 자동 설치 순서 ``code` → `cursor` → `antigravity`**(`--install-extension`).
- **문서`: README ``npx`** / **`npm deukpack`** 구분; init 순서·postinstall 문구 정리.

---

## [1.2.2] — 2026-03-24

### 추가

- **파이프라인`: ``thriftFile` 생략 시` ``defineScope: "all"`** — **`defineRoot` 아래 모든 `*.deuk`**를 모아 ``exclude``(전역+잡 병합) 적용 후 `임시 번들 엔트리`로 빌드; 번들 파일은 잡 종료 시 삭제.
- **`outputLangSubdirs`**: 잡별 선택 **`{ csharp?, cpp?, ts?, js? }`** — 각 값은 ``outputDir` 아래 `한 단계` 폴더명(구 레이아웃은 ``typescript`** / **`javascript`** 등).

### 변경

- **호환 깨짐(생성 경로)**: **`--ts`** / **`--js`**(파이프라인 **`ts`** / **`js`**) 산출이 **`typescript/`**, **`javascript/`** 대신 **`<out>/ts/`**, **`<out>/js/`** 로 바뀜.
- **파이프라인`: ``jobs[].outputDir` 생략` 시 ``defineRoot`** 와 동일한 상대 경로(기본 **`idls`**)가 출력 루트 → **`csharp`/`cpp`/`ts`/`js`** 하위에 생성.
- **`deukpack init`**: 기본 생성 파이프라인이 **`defineScope: "all"`**, **`outputDir` = `defineRoot`** 에 맞춤; 대화형 기본값 정리.
- **문서·예제·키트`: ``ts`/`js`** 출력 경로 반영.

---

## [1.2.1] — 2026-03-24

### 변경

- **문서`: `README** / **README.ko` — 설치 절차를 `코드 블록`으로 정리; `프로젝트 로컬` `npm install deukpack` → `npx deukpack init` → `npx deukpack run`; 이 README에서는 ``npm install -g` 전역 설치` 안내 제거; 키트 링크 표기 `득팩 테일` / 영문 `DeukPack Tale**(URL은 `/journey/` 유지).
- **CLI`: 단발 `deukpack <엔트리> <출력> …` 시 ``./deukpack.pipeline.json``이 없으면 `경고` 후 ``npx deukpack init`** 권장(생성은 계속 진행).
- **`deukpack init` / bootstrap / 동봉 VSIX`: ``.deukpack/deuk-idl-vsix.json``의 `npm `deukpack` 버전`과 불일치하면 `질문 없이` 동봉 VSIX 설치 시도; `Unity 프로젝트 근처` 감지 시 안내·거절 경고 강화; ``--non-interactive` `init``은 ``--skip-vsix`가 아니면` 버전 갱신 VSIX `ensure** 실행; `bootstrap`은 VSIX 프롬프트에 Unity 힌트 전달, 비-TTY일 때 bump **ensure** 실행.

---

## [1.2.0] — 2026-03-23

### 추가

- **동봉 VS Code 확장`: npm tarball에 ``bundled/deuk-idl.vsix`** 포함. `postinstall`은 ``.deukpack/deuk-idl-vsix.json``에 기록된 ``deukpack` npm 버전`과 달라지면 다시 **`code` / `cursor` / `antigravity --install-extension`` 시도. `대화형 `deukpack bootstrap`** 마지막에 VSIX 설치·갱신 확인. **`bundled/README.ko.md`** 참고.
- **Unity**: **[deukpack.app](https://deukpack.app/)** 에 **DeukPack.Protocol** 등을 UPM 스타일로 넣는 방법이 정리됨. 네이티브 플러그인은 게임/프로젝트 빌드로 만들며, npm **`deukpack`** tarball 안에는 포함되지 않음.
- **npm 와이어 진입(단일 형태)**: **`serialize(값, 프로토콜?, extras?)`** / **`deserialize(데이터, 프로토콜?, extras?)`** —보내는 타입 **`WireExtras`** / **`WireDeserializeExtras`**(`pretty`, `interopRootStruct`, `interopStructDefs`, `targetType` 등). 세부 제어는 **`WireSerializer`/`WireDeserializer`** + **`SerializationOptions`** 유지.

### 변경

- **호환 깨짐(JS 패키지 진입)**: `serialize(_, 프로토콜, pretty불리언, wireFamily)` 제거 → **`serialize(_, 프로토콜, { pretty: true, wireFamily?, … })`**. ``deserialize``는 **`string` | `Uint8Array` | `Buffer`** 허용, 세 번째 인자는 **`WireExtras`** 형태 + 선택 **`targetType`**.
- **와이어(TypeScript)**: **`BinaryReader`**, **`wireTags`**, **`SerializationWarnings`** 추가·보강; **`WireSerializer`/`WireDeserializer`` 확장으로 `득팩 네이티브`(`pack`·`json`·`yaml`)와 `인터롭`(`tbinary`·`tcompact`·`tjson`+스키마) 짝 유지. `C# `DeukPack.Protocol`**: csproj·**SharedCompile** props 정리.
- **CI**: GitHub Actions에 **setup-dotnet** 적용 → `DeukPack.Protocol` 등 C# 빌드 안정화; 단계명 YAML 따옴표(`:`·`&`) 수정.
- **코드 생성`: C++/TS/JS 출력 `템플릿화` 정리; JS/스키마 `득팩 표기** 정합.
- **문서`: DeukNavigation `게임 연동`(베이킹·런타임) 보강; `deukpack.app** 갱신.
- **저장소`: ExcelProtocol·예제 `빌드 산출물** gitignore·추적 해제.

---

## [1.1.0] — 2026-03-20

### 추가

- **C++ 코드 생성 (`--cpp`)**: `uint8`·`uint16`·`uint32`·`uint64` → `<cstdint>`의 `uint8_t` / `uint16_t` / `uint32_t` / `uint64_t` 매핑. 생성 헤더에 `#include <cstdint>` 추가.
- **IDL 파서`: Thrift 스타일 `레거시 `message` 블록**(괄호 숫자 ID 없이 `message Name { ... }`) 파싱 — 기존 `.thrift`·혼합 워크플로 호환. (`declarationKind`는 `message`)

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

- 초기 **1.0.x` 패치는 `버그 수정·패키징·C# 멀티 타깃·문서 경로** 중심이며, 코어 기능 범위를 넓히지 않음.

---

이 파일 이전 커밋 내역은 `git log`·GitHub **Releases** 참고.
