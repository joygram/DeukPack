# 10편: C#(Unity), C++, TypeScript를 아우르는 '단일 진실 공급원(SSOT)' 구축

현대 개발 프로젝트는 거의 예외 없이 다국어(Multi-language) 환경입니다. 
클라이언트는 Unity(C#)로, 코어 전투 서버는 C++로, 백엔드 API와 백오피스 웹은 TypeScript로 작성됩니다. 이 거대한 분산 환경에서 가장 끔찍한 버그는 언제 발생할까요?

바로 **"서버가 보낸 데이터를 클라이언트가 다르게 해석할 때"** 입니다.

## 수동 동기화의 비극

서버 개발자가 `PlayerInfo` 구조체에 `int32 level` 필드를 추가했습니다. 그리고 슬랙으로 프론트엔드 팀에게 알려줍니다. "API 응답에 level 필드 추가했어요."

하지만 웹 프론트엔드 개발자는 바빠서 TypeScript `interface PlayerInfo`를 업데이트하는 것을 잊었습니다. 혹은 `int32`를 `string`으로 착각했습니다. 결국 배포 날 런타임 에러가 발생하고, 원인을 찾느라 귀중한 시간을 날립니다.

## DeukPack: 진정한 단일 진실 공급원(Single Source of Truth)

DeukPack은 데이터 구조에 대한 '약속'을 사람이 아닌 **시스템**이 보장하도록 만듭니다.

모든 데이터 구조는 단 하나의 `.deuk` IDL 파일에 정의됩니다.

```deuk
// common_types.deuk
record PlayerInfo {
  1> int64 id
  2> string nickname
  3> int32 level
}
```

이 파일 하나를 DeukPack 컴파일러(`deukc`)에 밀어 넣으면, 단 1초 만에 다음 파일들이 생성됩니다.
* **Unity용:** `PlayerInfo.cs` (메모리 풀링된 고성능 직렬화 코드 포함)
* **서버용:** `PlayerInfo.h`, `PlayerInfo.cpp`
* **웹용:** `PlayerInfo.ts` (정확한 타이핑을 가진 TypeScript 인터페이스)

## 결론: 언어의 장벽을 허물다

이제 스펙이 변경되면 IDL 파일만 수정하고 빌드 버튼을 누르면 됩니다. C++ 서버, C# 클라이언트, TS 웹의 모든 타입이 0.1초 만에 완벽하게 일치된 상태로 동기화됩니다. 

DeukPack은 단순한 통신 라이브러리가 아닙니다. 다국어 환경의 팀원들이 서로 의심하지 않고 협업할 수 있게 해주는 **강력한 스키마 파이프라인**입니다.