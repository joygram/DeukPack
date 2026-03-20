# DeukPack

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://img.shields.io/npm/v/deukpack.svg)](https://www.npmjs.com/package/deukpack)

**언어 / Languages:** [English](README.md) · [한국어](README.ko.md)

**득팩(DeukPack)** — **네이티브 `.deuk` IDL** 을 중심으로 **Protobuf·OpenAPI·JSON Schema·CSV·레거시 `.thrift`** 까지 한 파이프라인에서 **C#·C++·JavaScript** 코드·스키마를 뽑는 **고속 파싱·코드 생성 엔진**.

---

## 왜 DeukPack인가?

- **속도:** 대량 IDL도 수십 배 빠른 파싱·코드 생성. 런타임 직렬화/역직렬화도 약 10배 빠른 수준. → [프로토콜·직렬화 가이드](https://deukpack.app/tutorial/protocol-serialization/)
- **단일 소스:** **`.deuk` 우선**; `.proto`, `.thrift`, OpenAPI 등과 한 빌드에 섞을 수 있음. → [코어·엔진](https://deukpack.app/products/core-engine/)
- **와이어:** **Protobuf 호환(Binary/Compact)** 을 표준으로; 필요 시 레거시 스택과 공존. → [프로토콜](https://deukpack.app/products/protocol/)
- **AI·에이전트:** `.deuk`, `.proto`, `.thrift`, OpenAPI 입력 → 결정론적 코드·직렬화. → [AI 파이프라인](https://deukpack.app/ai-pipeline-integration/)

---

## 기능 요약

- **고속 성능:** 대량 IDL 파싱·코드 생성
- **다언어:** TypeScript, JavaScript, C++, C#
- **네이티브 바인딩:** C++ 네이티브 모듈
- **크로스 플랫폼:** Windows, macOS, Linux
- **타입 안전:** 생성 타입으로 TypeScript 지원

## 설치

[OS별 설치](https://deukpack.app/tutorial/install-os/) · [배포본 vs 소스본](https://deukpack.app/tutorial/distribution-vs-source/)

```bash
npm install deukpack
```

## CLI 사용

```bash
npx deukpack ./schema.deuk ./out --csharp --cpp

npx deukpack ./api.deuk ./gen -I ./includes --csharp --protocol binary

npx deukpack --pipeline ./deukpack-pipeline.json
```

**가이드:** [빠른 시작](https://deukpack.app/tutorial/quickstart/) · [IDL 가이드](https://deukpack.app/tutorial/idl-guide/) · [C#](https://deukpack.app/tutorial/csharp-guide/) · [C++](https://deukpack.app/tutorial/cpp-guide/) · [파이프라인](https://deukpack.app/tutorial/pipeline-guide/)  
**레퍼런스:** [API·타입](https://deukpack.app/reference/api/) · [프로토콜·직렬화](https://deukpack.app/tutorial/protocol-serialization/)

## 성능

| 항목 | 일반적 IDL 컴파일러류 | DeukPack | 개선 |
|------|----------------|----------|------|
| 160파일 파싱 | 15–25초 | 0.5–1초 | **25–50배** |
| TypeScript 코드젠 | 2–3초 | 0.1–0.2초 | **15–30배** |
| 직렬화 | 0.5ms | 0.05ms | **10배** |
| 역직렬화 | 0.8ms | 0.08ms | **10배** |

## 문서

| | |
|--|--|
| **튜토리얼** | [deukpack.app/tutorial](https://deukpack.app/tutorial/) |
| **API 레퍼런스** | [deukpack.app/reference/api](https://deukpack.app/reference/api/) |
| **제품군** | [deukpack.app/products](https://deukpack.app/products/) |
| **스타터 키트** | [deukpack.app/starter-kits](https://deukpack.app/starter-kits/) |
| **라이선스** | [deukpack.app/license](https://deukpack.app/license/) |

**사이트:** [deukpack.app](https://deukpack.app/) · **문의:** contact@deukpack.app

## 개발

```bash
npm ci
npm run build
npm test
```

## 후원

득팩은 **Apache-2.0 무료**입니다. 도움이 되셨다면 후원으로 응원해 주세요:

- **[PayPal로 후원하기](https://www.paypal.com/donate/?business=joygram%40gmail.com&currency_code=USD&item_name=DeukPack%20development)**

**Star**, **이슈**, **PR**, **소개**만으로도 큰 힘이 됩니다.

## 기여

1. Fork → 기능 브랜치 → PR
2. 릴리즈 규칙: [RELEASING.md](RELEASING.md)

## 라이선스

**Apache License 2.0** — [LICENSE](LICENSE) · [NOTICE](NOTICE)
