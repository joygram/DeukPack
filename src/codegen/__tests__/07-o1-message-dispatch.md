# 07편: O(1) 메시지 디스패치: 수백 개의 패킷 핸들러를 우아하게 관리하는 법

MMORPG나 복잡한 실시간 애플리케이션을 개발하다 보면 수백, 수천 종류의 네트워크 패킷을 처리하게 됩니다. 이때 서버 개발자들을 괴롭히는 거대한 괴물이 하나 탄생하는데, 바로 끝없이 이어지는 `switch-case` 문입니다.

## 전통적인 방식의 고통

보통은 수신부에서 패킷의 ID를 읽은 뒤 아래와 같은 코드를 작성합니다.

```csharp
switch (msgId) {
    case 1001: HandleLogin(Deserialize<LoginReq>(buffer)); break;
    case 1002: HandleMove(Deserialize<MoveReq>(buffer)); break;
    // ... 수백 개의 case 문 ...
}
```
패킷이 추가될 때마다 핸들러를 구현하고, 이 거대한 `switch` 문을 수동으로 업데이트해야 합니다. 이는 O(N)의 시간 복잡도를 가질 뿐만 아니라, 개발자의 잦은 실수(case 누락, 타입 매스매치)를 유발합니다.

## DeukPack의 ProtocolRegistry와 O(1) 디스패치

DeukPack은 이 지긋지긋한 반복 작업을 코드 생성 단계에서 원천적으로 제거합니다. 
IDL 파일(`.deuk`)에 `message<1001> req_login` 이라고 선언하는 순간, 마법이 일어납니다.

### 자동화된 레지스트리
DeukPack 컴파일러는 `ProtocolRegistry`라는 클래스를 자동으로 생성합니다. 이 레지스트리는 `msgId`와 '해당 메시지를 역직렬화하는 팩토리 함수'를 해시맵(Dictionary) 또는 배열 기반으로 미리 연결해 둡니다.

### 우아한 수신 파이프라인
이제 서버의 수신부는 단 세 줄로 요약됩니다.

1. 헤더에서 `msgId`를 읽는다.
2. `ProtocolRegistry.CreateMessage(msgId)`를 호출해 O(1) 속도로 완벽한 타입의 객체를 반환받는다.
3. 이벤트 버스나 핸들러 인터페이스로 던진다.

`switch-case` 문은 완전히 사라집니다. 개발자는 그저 `IHandler<req_login>` 인터페이스를 구현하는 클래스 하나만 작성하면 됩니다.

## 결론: 휴먼 에러 제로, 성능은 최고

수백 개의 패킷을 관리하는 일은 더 이상 두려운 일이 아닙니다. DeukPack의 자동화된 메시지 디스패치 시스템은 개발팀에게 '비즈니스 로직에만 집중할 수 있는 자유'와 '조회 비용 O(1)의 극한 성능'을 동시에 선사합니다.