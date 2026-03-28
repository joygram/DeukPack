# DeukPack: AI-Ready 인터페이스 허브

> **AI 시대를 위한 Mixed-IDL 하이브리드 시리얼라이저.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)

**언어 / Languages:** [English](README.md) · [한국어](README.ko.md)

**AI 시대의 돌파구:** 여러 IDL 정의(Protobuf, OpenAPI, JSON Schema, CSV, 레거시 `.thrift`)를 **결정론적이고 타입 안전한 C#, C++, TypeScript, JavaScript** 코드로 변환하며, **AI 시맨틱 매핑**과 **MCP 기반 가드레일**을 제공합니다.

**여기서 시작 — 목적 하나만 고르기**

- **내 프로젝트에 바로 쓰기**  
  프로젝트 루트 로컬 설치 → 아래 [설치](#설치) · [설치·튜토리얼](https://deukpack.app/tutorial/)

- **설명서·스펙 읽기**  
  [deukpack.app](https://deukpack.app/)  
  [API 레퍼런스](https://deukpack.app/reference/api/)

- **폴더를 열고 손으로 돌리기**  
  [처음부터 콘솔 따라하기](https://kits.deukpack.app/starter-course/hands-on/)  
  [득팩 테일](https://kits.deukpack.app/journey/) · [《시작의 폐허》](https://kits.deukpack.app/starter-course/)

> **v1 npm 공개 범위**  
> IDL → 다언어 코드젠 · CLI · Binary/Compact/JSON 와이어  
> 정본: [DEUKPACK_V1_RELEASE_SCOPE.md](https://deukpack.app/positioning/)
>
> **버전**  
> [`package.json`](package.json)의 `version`과 상단 npm 배지  
> 릴리스별 차이: [CHANGELOG.ko.md](CHANGELOG.ko.md)

---

## 왜 DeukPack인가? (AI-Ready 강점)

### 1. 통합 인터페이스 관리 (Thrift + Protobuf)
현대 기업용 시스템은 구형 레거시(Thrift 기반)와 신규 서비스(gRPC/Protobuf)가 섞여 있어 AI가 전체 맥락을 파악하기 매우 어렵습니다.
- **득팩의 솔루션:** 상위 IDL 레이어에서 Thrift, Protobuf, OpenAPI 정의를 동시에 파싱하고 타입을 통합 매핑합니다. AI 에이전트에게 100% 명확한 바이너리 스펙을 제공하여 추측성 동작(Hallucination)을 원천 차단합니다.

### 2. IDL-to-AI 시맨틱 매핑
단순한 데이터 타입을 넘어, IDL 주석(`/** ... */`)이나 필드 구조에서 추출된 메타데이터를 AI가 즉시 이해할 수 있는 **'의미론적 맥락(Semantic Context)'**으로 전환합니다.
- **돌파구:** 엔지니어는 단순 코딩 대신, 득팩에서 **데이터의 계보(Lineage)**를 설계하는 고차원 설계자로 진화합니다.

### 3. MCP 기반 AI 가드레일
기존 MCP(Model Context Protocol)는 JSON 기반이라 엄격한 타입 체크가 어렵습니다.
- **득팩의 솔루션:** 득팩은 스스로 **MCP 서버**가 되어 강력한 타입이 보장된 데이터를 공급합니다. AI가 잘못된 타입을 생성하려 하면 시리얼라이즈 단계에서 거부(Blocking)하여 런타임 오류를 방지합니다.

### 4. 고성능 런타임
대량 IDL 파싱 및 다언어 코드젠 속도는 기존 컴파일러 대비 **수십 배 빠르며**, 직렬화/역직렬화 역시 **~10배** 수준의 성능 이득을 제공합니다. 수치는 아래 [성능](#성능) 표를 참고하세요.

---

---

## 설치

OS별·상세 안내는 [deukpack.app/tutorial](https://deukpack.app/tutorial/)을 보세요.

**프로젝트 루트에서 로컬 설치**만 안내합니다(레포마다 버전 고정). **`npm install -g deukpack`** 전역 설치는 이 README에서 다루지 않습니다.

프로젝트 루트에서:

```bash
npm install deukpack
npx deukpack init
npx deukpack run         # 기본: ./deukpack.pipeline.json
```

**CLI:** **`npx deukpack …`**는 이 프로젝트 **`node_modules/.bin`**의 **`deukpack`**을 실행합니다(개념상 **`npm exec deukpack -- …`**와 같음). **`npm deukpack`**은 npm 하위 명령이 아니므로 **`npx`**를 쓰거나, `package.json`의 scripts로 **`deukpack`**을 호출하세요.

의존성 전에 `package.json`만 먼저 만들고 싶다면(선택): `npm init -y` 후 `npm install deukpack`. 보통은 **`npm install deukpack`만 해도 됩니다** — npm이 필요하면 `package.json`을 만들거나 갱신합니다.

**`npx deukpack init`**은 **`deukpack.pipeline.json`**을 쓴 뒤 **bootstrap**으로 **`.deukpack/workspace.json`**을 만들거나 갱신합니다(Unity·프로젝트 탐색; **`installKind`** 기본값은 **`package`**이며 **`--kind src`**와 **`--engine-root`**를 같이 줄 때만 엔진 연동). 마지막에 동봉 **`bundled/deuk-idl.vsix`**를 **질문 없이** 설치 시도합니다(**VS Code** `code` / **Cursor** `cursor` / **Antigravity** `antigravity`, `PATH` 필요; 생략은 **`--skip-vsix`**). VSIX 경로·수동 설치: [`bundled/README.ko.md`](bundled/README.ko.md).

GitHub Release tarball:

```bash
npm install ./deukpack-x.y.z.tgz
```

**`npm install deukpack` 직후 postinstall**은 **`deukpack.pipeline.json`**과 **`.deukpack/workspace.json`**이 둘 다 없을 때만 **`npx deukpack init`** 안내를 출력합니다.

파이프라인 없이 **`npx deukpack <엔트리.deuk> <출력폴더> …`**로 한 번만 돌리는 것도 가능합니다. 이때 현재 디렉터리에 **`deukpack.pipeline.json`**이 없으면 **경고** 후 **`npx deukpack init`**을 권합니다.

---

아래 표는 **참고용**이며, **유휴가 많은 전용 머신·고정 툴체인**을 가정한다. **버스트형 클라우드 VM**이나 **서로 다른 CPU**에서의 절대 ms는 **보장되지 않는다.** README에 **실제 게임용 대형 `idls`(테이블 포함) 공개 수치**를 넣지 않는 이유, **코드젠만의 시간·스트림 I/O**, **`thrift` / `protoc` CLI** 비교는 에 정리했다.

| 항목 | 일반 IDL 컴파일러류 | DeukPack | 개선 |
|------|---------------------|----------|------|
| 160파일 파싱 | 15–25초 | 0.5–1초 | **~25–50×** |
| TypeScript 코드젠 | 2–3초 | 0.1–0.2초 | **~15–30×** |
| 직렬화 | 0.5ms | 0.05ms | **~10×** |
| 역직렬화 | 0.8ms | 0.08ms | **~10×** |
| 메모리 | ~100MB | ~20MB | **~5×** |

**

---

## 문서

| | |
|--|--|
| **이 README** | 클론 직후 요약 |
| **기능 개요(클론)** | [DEUKPACK_FEATURES.ko.md](docs/DEUKPACK_FEATURES.ko.md) · [EN](docs/DEUKPACK_FEATURES.md) |
| **[deukpack.app](https://deukpack.app/)** | 설치 · 튜토리얼 · 프로토콜<br>[API 레퍼런스](https://deukpack.app/reference/api/) |
| **[kits.deukpack.app](https://kits.deukpack.app/)** | [콘솔 따라하기](https://kits.deukpack.app/starter-course/hands-on/)<br>[《시작의 폐허》](https://kits.deukpack.app/starter-course/) · [득팩 테일](https://kits.deukpack.app/journey/) |
| **키트 저장소 안내** | [득팩 키트 라인업](https://deukpack.app/starter-kits/) |
| **릴리즈** | [RELEASING.md](RELEASING.ko.md) |
| **클론본 전체 문서 목차** | [docs/README.ko.md](https://github.com/joygram/DeukPack/blob/main/docs/README.ko.md) (npm tarball에는 없음) |

**문의**

- contact@deukpack.app
- [deukpack.app](https://deukpack.app/)

---

## 프로젝트 구조

```
DeukPack/
├── src/              # TypeScript 소스
├── native/           # C++/C# 네이티브
├── docs/             # 기술 문서 원본 (npm·OSS tarball에는 없음; 안내는 deukpack.app URL)
├── deukpack.app/     # 제품 소개 사이트 (선택 서브모듈; OSS 공개 미러에는 없음)
└── dist/             # 빌드 결과물
```

공개 미러 동기화에는 `deukpack.app`·`docs/`가 포함되지 않는다. GitHub/OSS용 README는 링크를 **deukpack.app** 도메인으로 치환한다.

---

## 개발

```bash
npm ci
npm run build
npm test
npm run test:idl-convert-smoke        # 선택: Thrift→.deuk 변환 스모크(작은 fixture)
```

---

## 개발 후원

득팩은 **Apache-2.0**으로 무료입니다. 라이선스 비용 없이 상용·내부 도구에 쓸 수 있습니다.

다만 문서·CI·호환성 수정·파서·코드젠 개선·이슈 대응 같은 유지 비용은 계속 듭니다.

득팩이 **CI 시간을 줄였거나**, **수작업 직렬화를 대체했거나**, **게임·서버 스택을 한 IDL로 맞추는 데** 도움이 되었다면 후원을 고려해 주세요. 금액은 부담 없는 선에서 일시·정기 모두 환영합니다.

후원금은 법인·단체가 아닌 유지보수자 개인 계정(`joygram@gmail.com`)으로 들어갑니다.

- **PayPal** — 앱/웹에서 **송금(Send)** → 수신자 `joygram@gmail.com`
- **Ko-fi** — [Ko-fi로 후원하기](https://ko-fi.com/joygram) (카드 · Apple Pay · Google Pay 등)

기부금 영수증(세액공제) 성격이 아닙니다. 개인 OSS 활동 지원(팁)으로 이해해 주세요.

후원이 어렵다면 **저장소 Star**, **재현 가능한 이슈**, **PR**, 또는 **득팩이 맞는 팀에 소개**만으로도 큰 힘이 됩니다.

---

## 함께 쓰면 좋은 도구 (Deuk Family)

**에이전트가 스펙으로 할 수 있는 일을 넓히고 싶다면** **DeukPack**을 쓰세요 — IDL에서 결정론적인 타입·직렬화까지 한 파이프라인입니다. **에이전트가 저장소 안에서 어떻게 움직일지 통제하고 싶다면** **[DeukAgentRules](https://github.com/joygram/DeukAgentRules)**를 쓰세요 — [`deuk-agent-rule`](https://www.npmjs.com/package/deuk-agent-rule) npm 패키지로 `AGENTS.md`와 규칙 템플릿을 버전 관리합니다.

**DeukPack과 같은 레포에서** (선택, dev 의존성):

```bash
npm install -D deuk-agent-rule
npx deuk-agent-rule init --non-interactive
```

핸드오프 관례와 스택에 맞는 규칙을 파이프라인 옆에 두면서, `deukpack` 빌드 방식은 그대로 둘 수 있습니다.

---

## 기여

1. 저장소 Fork → 기능 브랜치 → PR
2. 릴리즈 체계: [RELEASING.md](RELEASING.ko.md) 참고

---

## 라이선스

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE)

---

**DeukPack** — 득팩 IDL 파이프라인으로 스펙부터 배포까지.
