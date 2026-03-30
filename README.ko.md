# DeukPack: AI-Native 유니버설 스키마 멀티 허브 (Protobuf, Thrift, OpenAPI 통합)

> **Protobuf, Thrift, OpenAPI를 하나로 묶는 고성능 유니버설 스키마 멀티 허브(Multi-hub).**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![npm downloads](https://img.shields.io/npm/dm/deukpack.svg)](https://www.npmjs.com/package/deukpack)
[![GitHub stars](https://img.shields.io/github/stars/joygram/DeukPack.svg?style=social)](https://github.com/joygram/DeukPack/stargazers)

**언어 / Languages:** [English](README.md) · [한국어](README.ko.md)

**AI 시대의 돌파구:** 여러 IDL 정의(Protobuf, OpenAPI, JSON Schema, CSV, 레거시 `.thrift`)를 **결정론적이고 타입 안전한 C#, C++, TypeScript, JavaScript** 코드로 변환하며, **AI 시맨틱 매핑**, **MCP 서버 자동 생성**, 그리고 **Zod 기반 가드레일**을 제공합니다.

### 🚀 Quick Start
```bash
npx deukpack init
```

---

**여기서 시작 — 한 가지만 고르세요**

- **내 저장소에 바로 적용:** 프로젝트 루트 로컬 설치 — **[설치](#설치)** · **[설치 및 튜토리얼](https://deukpack.app/ko/tutorial/)**.
- **매뉴얼 읽기:** **[deukpack.app](https://deukpack.app/ko/)** — 개요, 프로토콜, **[API 레퍼런스](https://deukpack.app/ko/reference/api/)**.
- **폴더에서 직접 실습 (🚧 봉인됨 - 곧 공개 예정):** **[제로 베이스 실습](https://kits.deukpack.app/ko/starter-course/hands-on/)**; 스토리 기반 온보딩 **[득팩 크로니클](https://kits.deukpack.app/ko/journey/)** 또는 *[무너진 유적](https://kits.deukpack.app/ko/starter-course/)*.

**사이트 및 문서의 역할**은 아래 **[문서 및 링크](#문서-및-링크)** 섹션에서 요약합니다.

**npm / OSS 공개 범위 (v1 제품군):** **IDL → 다언어 코드젠, CLI**, Binary/Compact/JSON 와이어. **Excel 프로토콜과 Excel Add-in은 별도로 배포되며**, 코어 npm 패키지에 포함되지 않습니다. **범위 및 로드맵:** [DEUKPACK_V1_RELEASE_SCOPE.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md) · 개요 **[deukpack.app](https://deukpack.app/ko/)**.

**버전:** [`package.json`](package.json)의 `version` 및 상단 **npm 배지** 기준. **1.0.x ↔ 1.1.0 ↔ 1.2.x** 변경 사항: [CHANGELOG.ko.md](CHANGELOG.ko.md) (KO) · [CHANGELOG.md](CHANGELOG.md) (EN).

---

## 왜 DeukPack인가: AI-Ready의 이점

### 1. 유니버설 IDL 게이트웨이 (OpenAPI, JSON Schema, Protobuf, Thrift, CSV)
현대 시스템은 레거시(Thrift), 현대적 인프라(Protobuf/gRPC), 웹 기반 API(OpenAPI/JSON Schema) 등 파편화된 인터페이스 스펙이 뒤섞여 있어 개발자와 AI 모두에게 거대한 "맥락의 공백"을 만듭니다.
- **원본 수정 없는 즉시 도입:** 기존의 `.proto`나 `.thrift` 파일을 **수정할 필요가 없습니다.** 득팩은 다양한 IDL 소스를 하나의 일관된 모델로 통합하는 **단일 진실 공급원(Single Source of Truth)** 역할을 합니다.
- **득팩의 솔루션:** 단순한 변환기를 넘어, 모든 인터페이스를 결정론적 SDK로 정렬하면서도 **기존 레거시 프로토콜과 완벽한 바이너리 호환성**을 유지합니다. *(참고: Protobuf 지원은 현재 프리뷰이며, 중첩 메시지 등 고급 기능은 개발 중입니다.)*

### 2. IDL-to-AI 시맨틱 매핑
단순한 데이터 타입을 넘어, IDL 주석(`/** ... */`)과 필드 구조에서 추출된 메타데이터를 AI가 즉시 이해할 수 있는 **'의미론적 맥락(Semantic Context)'**으로 전환합니다.
- **돌파구:** 엔지니어는 단순 코딩 업무에서 벗어나, 데이터의 계보(Lineage)를 기계가 읽을 수 있는 형태로 설계하는 정교한 **상위 아키텍트**로 진화합니다.

### 3. AI-Native 실행 브리지 (MCP 플러그인 대응)
기존의 IDL 도구들이 정적인 코딩만 지원했다면, 득팩은 에이전트가 현실 세계와 소통할 수 있는 **런타임 실행 브리지**를 구축합니다.
- **플러그인 기반 확장:** **MCP(Model Context Protocol)** 서버 자동 생성 기능을 별도 플러그인(`DeukPackMcp`)으로 분리하여 코어의 경량화와 확장성을 동시에 확보했습니다. Cursor, Claude Desktop 등의 AI 에이전트가 코어에서 추출된 **지능형 컨텍스트**를 기반으로 실시간 문서를 조회하고 백엔드 기능을 실행할 수 있도록 지원합니다.

### 4. Zero-Allocation 극한의 성능 (Bottleneck-Free)
득팩은 리소스 효율성을 위해 설계되었습니다. 수백 개의 IDL 파일을 파싱하거나 대규모 객체를 직렬화할 때, 기존 업계 표준 대비 **수십 배 이상의 속도와 낮은 메모리 점유율**을 유지합니다. 실제 수치는 아래 [성능](#성능-병목-없는-지능형-코어) 섹션을 참고하세요.

---

## 🚀 릴리스 로드맵 (Roadmap)

득팩(DeukPack)은 언어·플랫폼 지원 확대 시마다 마이너 버전을 갱신하며, 현재 **v1.5.x 시리즈**를 통해 생태계를 확장 중입니다.

| 버전 | 주요 목표 (Milestones) | 상태 |
| :--- | :--- | :--- |
| **v1.4.0** | MCP Protobuf 확장, C#/C++/JS 코어 런타임 안정화 | **DONE** |
| **v1.5.0** | **Java & Core Parity**: 상속 지원, Compact/TJSON 추가, 전수 보안 가드 및 **MCP 코어 분리** | **Current** |
| **v1.5.1** | C++ 저지연(Zero-Alloc) 최적화 및 DDL 생성기 보강 | In Progress |
| **v1.6.0** | **Elixir Expansion Pilot**: BEAM 기반 초고성능 분산 백엔드 지원 | **Teaser** |

---



득팩은 단순히 빠른 것을 넘어, AI 에이전트가 수만 줄의 IDL 지식을 실시간으로 다루어도 시스템에 주하를 주지 않는 **"지연 없는 지능형 코어"**를 지향합니다.

| 작업 항목 | 기존 레거시 워크플로 | **DeukPack (v1.5.0)** | 핵심 이점 |
| :--- | :---: | :---: | :--- |
| **IDL 트리 파싱** | 초(s) 단위 (다단계 빌드) | **밀리초(ms) 단위** | **AI 실시간 인터랙션 최적화** |
| **런타임 오버헤드** | 객체 할당 및 GC 발생 | **Zero-Allocation** | **고빈도 데이터 통신(HFT) 지원** |

> [!TIP]
> 위 수치는 대규모 프로젝트 환경(500+ IDL 파일)에서의 일반적인 관측치를 기반으로 하며, 사용자 환경 및 IDL 복잡도에 따라 차이가 있을 수 있습니다. 상세 벤치마크 방법론은 [성능 문서](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_BENCHMARKING.ko.md)를 참고하세요.

### 버전 관리 정책 (Versioning Policy)

- **Minor (0.X.0)**: **신규 언어 지원**, **신규 플랫폼 아웃풋** 추가 및 주요 기능 확장.
- **Patch (0.0.X)**: 기존 기능의 버그 수정, 성능 최적화, 사소한 개선.

---

## 기능 지원 매트릭스 (Feature Matrix)

각 타겟 플랫폼별 지원 현황 및 계획입니다.

| 카테고리 | 기능 | TS / JS | C# / Unity | C++ | Java | Elixir |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **IDL 코어** | 기본 타입 / 타입 별칭 | ✅ | ✅ | ✅ | ✅ | 🚧 (v1.6) |
| **상속** | `extends` 지원 | ✅ | ✅ | ✅ | ✅ (v1.5) | 🚧 (v1.6) |
| **프로토콜** | Native Pack (.dpk) | ✅ | ✅ | ✅ | ✅ | 🚧 (v1.6) |
| | Protobuf Compatible | ✅ | ✅ | 🚧 (v1.4) | ✅ | - |
| | Thrift Compatible (T-Series) | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| | JSON (Tagged / POJO) | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| | YAML / CSV | ✅ | ✅ (v1.2.7) | 🚧 | 🚧 | - |
| **최적화**| Zero-Alloc 파싱 | ⚠️ | ✅ | ✅ (v1.4.2) | 🚧 | 🚧 (BEAM) |
| | `Write` 로직 오버라이드 | ✅ | ✅ | ✅ (v1.5) | ✅ (v1.5) | - |
| **데이터/메타** | `tablelink` / MetaTable | ✅ | ✅ | ✅ (v1.5) | ✅ | - |
| | DB 연동 (EF / SQL) | ⚠️ (1) | ⚠️ (2) | ⚠️ (3) | 🚧 (v1.5) | - |
| **AI & IDE 통합** | 도구 자동 생성 (Skill) | ✅ (v1.5 MCP 분리) | 🚧 | - | - | - |
| | 지능형 컨텍스트 (Knowledge) | ✅ (Core Ready) | ✅ | ✅ | ✅ | ✅ |
| | IDE 인코더/인텔리센스 | ✅ | ✅ | ✅ | ✅ | ✅ |

- ✅: 정식 지원 / Production Ready
- ⚠️: 프리뷰 / 일부 기능 지원 또는 제약 있음
- 🚧: 파일럿 / 개발 진행 중
- -: 현재 미지원

> [!CAUTION]
> **데이터베이스 연동 (⚠️) 상세 제약 사항:**
> 1. **TS / JS**: JSON/Binary 직렬화 기반 저장 위주. 관계형 매핑은 제한적(Blob 중심).
> 2. **C# (EF Core)**: `entity` 키워드를 통한 테이블 생성 지원. 단, **중첩 컬렉션(List/Map/Set)** 필드는 SQL 컬럼 자동 매핑 미지원 (Blob 저장 또는 수동 Converter 필요).
> 3. **C++**: DDL(SQL) 생성 위주. 런타임 ORM 연동은 지원되지 않음.
> 4. **공통**: 스키마 구조 변경에 따른 DB Migration(변경 관리) 로직은 제공되지 않음.

### 언어별 주요 특징

*   **C# (.NET / Unity)**: 게임 클라이언트를 위한 **Zero-Allocation** 파서, 백엔드 연동을 위한 **EF Core** 지원(제약사항 참고), 그리고 IDL 기반 설정 관리를 위한 **MetaTable Registry**, **YAML 프로토콜**(v1.2.7) 기능을 제공합니다.
*   **TypeScript / JSON**: AI 도구 호출을 위한 **MCP (Model Context Protocol)** 플러그인 대응 및 지능형 컨텍스트 추출, 순수 JS 객체(**POJO**) 기반의 유연한 매핑, 그리고 v1.5.0에서 분리된 **DeukPackMcp**를 통한 도구 실행 환경을 지원합니다.
*   **C++**: **저지연(Low-latency)** 및 **임베디드** 환경에 최적화되어 있으며, v1.5.0에서 안정화된 **Binary/Compact** 및 **JSON** 프로토콜 호환성과 최소한의 메모리 점유율에 집중합니다.
*   **Java**: 다양한 플랫폼 간의 상호운용성을 보장하며, v1.5.0에서 추가된 **상속(extends)** 지원과 **Compact/TJSON** 프로토콜을 통해 Thrift 생태계와의 완전한 패리티를 달성했습니다.

---

## 설치

상세 튜토리얼 및 OS별 안내: **[deukpack.app/ko/tutorial](https://deukpack.app/ko/tutorial/)**.

**프로젝트 루트에 로컬 설치**하는 것을 권장합니다(레포별 버전 고정). 이 가이드는 **`npm install -g deukpack`** (전역 설치)을 다루지 않습니다.

프로젝트 루트에서:

```bash
npm install deukpack
npx deukpack init
npx deukpack run         # 기본값: ./deukpack.pipeline.json
```

**CLI 참고:** **`npx deukpack …`**은 이 프로젝트의 **`node_modules/.bin`**에 설치된 **`deukpack`** 실행 파일을 호출합니다. **`npm deukpack`**은 유효한 npm 명령어가 아닙니다. **`npx`**를 사용하거나 `package.json`의 scripts를 사용하세요.

**`npx deukpack init`**은 **`deukpack.pipeline.json`**을 작성하고 **bootstrap**을 실행합니다. 이를 통해 **`.deukpack/workspace.json`**(Unity/프로젝트 탐색 정보)이 생성되거나 갱신됩니다. 마지막에는 VS Code, Cursor 등에 에디터 확장을 설치하기 위해 **`bundled/deuk-idl.vsix`** 설치를 시도합니다(건너뛰기는 **`--skip-vsix`**). 수동 설치 안내: [`bundled/README.ko.md`](bundled/README.ko.md).

GitHub 릴리스 타볼(tarball) 기준 설치:

```bash
npm install ./deukpack-x.y.z.tgz
```

**`npm install deukpack` postinstall**은 초기 설정 파일이 없을 때만 **`npx deukpack init`** 안내를 출력합니다. 파이프라인 파일 없이 **`npx deukpack <entry.deuk> <outDir>`** 명령어로 1회성 실행도 가능합니다.

---

## 문서 및 링크

| 구분 | 내용 |
| :--- | :--- |
| **이 README** | 설치 및 퀵스타트 요약 |
| **기능 상세 (클론본)** | [DEUKPACK_FEATURES.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_FEATURES.ko.md) · [EN](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_FEATURES.md) |
| **[deukpack.app](https://deukpack.app/ko/)** | 설치, 튜토리얼, 프로토콜, [API 레퍼런스](https://deukpack.app/ko/reference/api/) |
| **[kits.deukpack.app](https://kits.deukpack.app/ko/)** | 🚧 봉인됨 — 곧 공개 예정 |
| **키트 라인업** | [deukpack.app/ko/starter-kits](https://deukpack.app/ko/starter-kits/) |
| **영문 README** | [README.md](README.md) |
| **릴리스 안내** | [RELEASING.md](RELEASING.md) |
| **전체 문서 목차** | [docs/README.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/README.ko.md) (npm 타볼 제외) |

**문의:** contact@deukpack.app

---



득팩(DeukPack)은 **극한의 확장성**과 **저지연 엔지니어링**을 목표로 설계되었습니다. 기존 IDL 스타일 컴파일러의 병목 현상을 제거하고 데이터 호환성을 유지하는 데 집중합니다.

- **빠른 TS/C# 코드 생성**: CI/CD 주기와 로컬 개발 환경의 핫 리로딩 속도에 최적화된 설계입니다.
- **효율적인 이진 포맷**: 고성능 패킹(DPK1) 및 최적화된 와이어 코덱을 구현하여 힙 메모리 압박을 최소화합니다.

상세 벤치마크는 다양한 하드웨어 및 클라우드 환경에서의 안정화 작업이 완료되는 대로 **[벤치마킹 가이드](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_BENCHMARKING.ko.md)**를 통해 정기적으로 업데이트됩니다.


---

## 개발 (Development)

```bash
npm ci
npm run build
npm test
```

---

## 후원 및 지원 (Support)

DeukPack은 **Apache-2.0** 라이선스로 제공되며, 라이선스 비용 없이 자유롭게 사용할 수 있습니다. 파이프라인의 지속적인 유지보수(CI, 호환성 수정, 신규 기능)를 위해 **여러분의 후원이 필요합니다.**

- **Ko-fi**: [Ko-fi로 응원하기](https://ko-fi.com/joygram) (카드, Apple Pay, Google Pay 등)

후원이 어렵더라도 **GitHub Star**, **이슈 제보**, **PR** 등으로 기여해 주시는 것만으로도 프로젝트에 큰 힘이 됩니다.

---

## 함께 쓰면 좋은 도구 (Deuk Family)

- **AI 에이전트의 스펙 접근성을 높이고 싶다면?** **DeukPack**을 통해 결정론적 타입과 직렬화를 실현하세요.
- **에이전트의 행동을 통제하고 싶다면?** **[DeukAgentRules](https://github.com/joygram/DeukAgentRules)**를 통해 구조화된 규칙 시스템을 도입하세요.

```bash
npm install -D deuk-agent-rule
npx deuk-agent-rule init --non-interactive
```

---

## 라이선스 (License)

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE).

---

## 감사 인사 (Acknowledgments)

IDL과 스키마 커뮤니티에 감사드립니다. 득팩은 단독 파이프라인으로 작동합니다.