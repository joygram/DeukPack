# DeukPack: AI-Native 유니버설 IDL 게이트웨이

> **AI 시대를 위한 Mixed-IDL 하이브리드 직렬화 파이프라인.**

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

### 3. AI-Native 실시간 실행 브리지 (MCP - 🚧 WIP)
기존의 IDL 도구들이 정적인 코딩만 지원했다면, 득팩은 에이전트가 현실 세계와 소통할 수 있는 **런타임 실행 브리지**를 구축합니다.
- **가드레일 자동화:** **MCP(Model Context Protocol)** 서버를 자동 생성합니다. Cursor, Claude Desktop 등의 AI 에이전트가 **실시간으로 문서를 조회**하고 **백엔드 기능(Tools)을 직접 실행**할 수 있습니다. **Zod 기반 가드레일**이 함께 작동하여 AI가 안전하게 시스템을 제어하도록 보장합니다.

### 4. Zero-Allocation 극한의 성능
득팩은 리소스 효율성을 위해 설계되었습니다. 수백 개의 IDL 파일을 파싱하거나 대규모 객체를 직렬화할 때, 기존 업계 표준 대비 **수십 배 이상의 속도와 낮은 메모리 점유율**을 유지합니다. 실제 수치는 아래 [성능](#성능-레거시-워크플로-대비) 표를 참고하세요.

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