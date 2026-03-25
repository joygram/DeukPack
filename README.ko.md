# DeukPack

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)

**언어 / Languages:** [English](README.md) · [한국어](README.ko.md) — GitHub에서 README 전체를 바꿉니다.

**하나의 IDL 줄기**에서 **C# · C++ · TypeScript · JavaScript** 타입, 직렬화, 레지스트리, 네트워크용 메시지 배치까지 한 파이프라인으로 뽑습니다.

`.deuk` 우선이며, Protobuf · OpenAPI · JSON Schema · CSV · 레거시 `.thrift`를 같은 빌드에 넣을 수 있습니다.

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
> 릴리스별 차이: [CHANGELOG.md](CHANGELOG.md)

---

## 왜 DeukPack인가?

### 속도

대량 IDL 파싱·코드젠은 통상 컴파일러류 워크플로 대비 수십 배 빠른 사례가 있습니다.

런타임 직렬화·역직렬화는 약 10배 수준의 이득을 목표로 합니다. 수치는 아래 [성능](#성능) 표를 참고하세요.

### 와이어 호환

| 계열 | 프로토콜 |
|------|----------|
| **interop** | Thrift Binary · Compact · `thrift_json` |
| **deuk** | `pack` · UTF-8 `json` · UTF-8 `yaml` |

- TS `WireSerializer`는 **deuk 전용**입니다. 레거시·호환 와이어는 생성된 C#/C++을 씁니다.
- `SerializationOptions`의 `wireFamily`로 `protocol`과 계열을 맞출 수 있습니다.
- `.deuk.json` / `.deuk.yaml`은 설정·OpenAPI용입니다. 레거시 JSON 와이어는 `DpJsonProtocol`입니다.
- 역직렬화 시 컬럼 누락·알 수 없는 필드에 대해 C# · JS · TS에서 경고를 보내 스키마 drift를 일찍 잡습니다.
- 상세: [DEUKPACK_WIRE_INTEROP_VS_NATIVE.md](https://deukpack.app/reference/wire-protocols/)

### 런타임·타입

GetSchema, SQLite, msgId · ProtocolRegistry 등 IDL에서 이어지는 런타임이 본체입니다.

- 구조체 상속(`extends`)
- 스칼라: int8–int64, uint, float/double, bool, string/binary, datetime, decimal
- 컨테이너: list, set, map, tablelink
- SQLite DDL · EF 연동 코드 생성

타입 전체·의미는 [API 레퍼런스](https://deukpack.app/reference/api/)를 보세요.

### 자동화·에이전트

`.deuk` · `.proto` · `.thrift` · OpenAPI 입력에서 결정론적인 코드·직렬화를 뽑습니다.

워크플로: [deukpack.app](https://deukpack.app/)

에이전트·자동화 참고: [DEUKPACK_AI_PIPELINE_INTEGRATION.md](https://deukpack.app/ai-pipeline-integration/)

### 플랫폼

Windows · macOS · Linux를 지원합니다.

C++ 네이티브 모듈과 버퍼 풀링 등, 메모리 사용을 염두에 둔 런타임입니다.

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

**`npx deukpack init`**은 **`deukpack.pipeline.json`**을 쓴 뒤 **bootstrap**으로 **`.deukpack/workspace.json`**을 만들거나 갱신합니다(Unity·프로젝트 탐색; **`installKind`** 기본값은 **`package`**이며 **`--kind src`**와 **`--engine-root`**를 같이 줄 때만 엔진 연동). 마지막에 동봉 **`bundled/deuk-idl.vsix`**를 **질문 없이** 설치 시도합니다(**VS Code** `code` / **Cursor** `cursor` / **Antigravity** `antigravity`, `PATH` 필요; 생략은 **`--skip-vsix`**). VSIX 경로·수동 설치: [`bundled/README.md`](bundled/README.md).

GitHub Release tarball:

```bash
npm install ./deukpack-x.y.z.tgz
```

**`npm install deukpack` 직후 postinstall**은 **`deukpack.pipeline.json`**과 **`.deukpack/workspace.json`**이 둘 다 없을 때만 **`npx deukpack init`** 안내를 출력합니다.

파이프라인 없이 **`npx deukpack <엔트리.deuk> <출력폴더> …`**로 한 번만 돌리는 것도 가능합니다. 이때 현재 디렉터리에 **`deukpack.pipeline.json`**이 없으면 **경고** 후 **`npx deukpack init`**을 권합니다.

---

| 항목 | 일반 IDL 컴파일러류 | DeukPack | 개선 |
|------|---------------------|----------|------|
| 160파일 파싱 | 15–25초 | 0.5–1초 | **~25–50×** |
| TypeScript 코드젠 | 2–3초 | 0.1–0.2초 | **~15–30×** |
| 직렬화 | 0.5ms | 0.05ms | **~10×** |
| 역직렬화 | 0.8ms | 0.08ms | **~10×** |
| 메모리 | ~100MB | ~20MB | **~5×** |

---

## 문서

| | |
|--|--|
| **이 README** | 클론 직후 요약 |
| **[deukpack.app](https://deukpack.app/)** | 설치 · 튜토리얼 · 프로토콜<br>[API 레퍼런스](https://deukpack.app/reference/api/) |
| **[kits.deukpack.app](https://kits.deukpack.app/)** | [콘솔 따라하기](https://kits.deukpack.app/starter-course/hands-on/)<br>[《시작의 폐허》](https://kits.deukpack.app/starter-course/) · [득팩 테일](https://kits.deukpack.app/journey/) |
| **키트 저장소 안내** | [득팩 키트 라인업](https://deukpack.app/starter-kits/) |
| **릴리즈** | [RELEASING.md](RELEASING.md) |
| **문서 안내** | [deukpack.app — 문서 안내](https://deukpack.app/documentation-index/) |

**문의**

- contact@deukpack.app
- [deukpack.app](https://deukpack.app/)

---

## 저장소 구성 (이 클론)

```
DeukPack/
├── src/              # TypeScript 소스
├── native/           # C++ 네이티브
├── scripts/          # CLI·빌드 스크립트
├── DeukPack.Protocol/# C# 런타임 소스
└── dist/             # 빌드 결과물 (npm publish 시 포함)
```

---

## 개발

```bash
npm ci
npm run build
npm test
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

## 기여

1. 저장소 Fork → 기능 브랜치 → PR
2. 릴리즈 체계: [RELEASING.md](RELEASING.md) 참고

---

## 라이선스

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE)

---

**DeukPack** — 득팩 IDL 파이프라인으로 스펙부터 배포까지.
