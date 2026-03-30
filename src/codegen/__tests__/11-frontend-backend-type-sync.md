# 11편: 프론트엔드(React/TS)와 백엔드의 완벽한 타입 동기화 실전

최근 웹 프론트엔드 개발의 표준은 단연 React와 TypeScript의 조합입니다. TypeScript의 엄격한 타입 시스템은 프론트엔드 코드의 안정성을 크게 높여주었지만, 백엔드 서버(C#, Node.js 등)와 통신하는 API 계층에서는 여전히 '타입의 사각지대'가 존재합니다.

## `any`의 유혹과 수동 인터페이스의 한계

서버에서 JSON 응답을 받아올 때 프론트엔드 개발자들은 두 가지 선택의 기로에 놓입니다.

1. `response.data as any` 처리: TypeScript를 쓰는 의미가 사라집니다.
2. 수동으로 `interface User { ... }` 작성: 백엔드 모델이 바뀔 때마다 수동으로 코드를 고쳐야 하며, 오타나 누락의 위험이 항상 존재합니다.

## DeukPack의 TS 코드 제너레이션

DeukPack은 백엔드 개발자가 정의한 `.deuk` 스키마를 바탕으로, 프론트엔드에서 즉시 사용할 수 있는 **완벽한 TypeScript 타입 정의(Type Definitions)와 직렬화/역직렬화 함수**를 자동으로 생성해 줍니다.

```typescript
// DeukPack이 자동 생성한 TS 코드
export interface UserInfo {
    id: bigint; // int64 매핑
    name: string;
    role: RoleEnum;
}

// JSON 파싱뿐만 아니라, 필요하다면 바이너리 역직렬화까지 지원
export function deserializeUserInfo(reader: TProtocol): UserInfo { ... }
```

### JSON과 Binary를 넘나드는 유연성
DeukPack의 위력은 프론트엔드에서도 바이너리 통신(WebSocket)과 JSON 기반 REST API 통신을 **동일한 스키마(타입)로 처리**할 수 있다는 점입니다.
* **실시간 게임 로비 통신:** DeukPack 바이너리 파서로 고속 디코딩.
* **일반적인 백오피스 웹:** DeukPack이 보장해준 TS 인터페이스를 바탕으로 일반 `fetch()` JSON 응답 사용.

## 결론: 프론트엔드 개발자의 안심 보장

DeukPack을 도입하면 프론트엔드 팀은 더 이상 백엔드 팀에게 "이 API 응답 스펙 최신화된 거 맞나요?"라고 물어볼 필요가 없습니다. 생성된 TypeScript 타입을 사용하는 것만으로, 컴파일 타임에 모든 API 계약 불일치 오류를 잡아낼 수 있습니다.