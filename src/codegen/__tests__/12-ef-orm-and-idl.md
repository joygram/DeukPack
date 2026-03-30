# 12편: Entity Framework(ORM)와 IDL의 만남: 지긋지긋한 DTO 복제 끝내기

서버 백엔드 개발자(특히 C#/.NET 환경)라면 하루에도 수십 번씩 하는 짜증 나는 작업이 있습니다. 바로 DB에 접근하기 위한 **Entity 모델**과 클라이언트에게 보내기 위한 **네트워크 DTO(Data Transfer Object) 모델**을 따로 만들고, 둘 사이를 매핑(Mapping)하는 코드(`AutoMapper` 등)를 작성하는 일입니다.

## 왜 두 번씩 만들어야 할까?

기존의 Protobuf나 Thrift는 오직 '통신을 위한 와이어 포맷'에 집중합니다. 그래서 생성된 클래스에는 ORM(Entity Framework)이 요구하는 `[Key]`, `[Table]` 같은 특성(Attribute)을 붙일 수가 없습니다. 결국 개발자는 다음과 같은 노동을 감수해야 합니다.

1. DB용 `UserEntity` 클래스 작성 (EF 특성 포함)
2. 네트워크용 `UserDto` IDL 작성 (Protobuf 등)
3. 두 객체의 값을 복사하는 `ToDto()`, `ToEntity()` 함수 작성

## DeukPack의 `entity` 키워드: 스키마의 융합

DeukPack은 이 반복 노동을 끝내기 위해 IDL 자체에 **`entity`** 키워드와 **C# Attribute 주입** 기능을 도입했습니다.

```deuk
// IDL에서 DB 스키마와 네트워크 DTO를 한 번에 정의
entity UserData {
  1> [Key] int64 UserId
  2> [MaxLength(50)] string UserName
  3> int32 Level
}
```

DeukPack 생성기는 위 코드를 바탕으로 C# 클래스를 생성할 때, Entity Framework가 즉시 인식할 수 있는 `[System.ComponentModel.DataAnnotations.Key]` 특성을 그대로 주입해 줍니다.

### 단일 모델의 마법
이제 개발자는 DeukPack이 생성해준 `UserData` 클래스 **단 하나**만으로, DB에서 데이터를 읽어오고(EF Core), 그 객체를 그대로 클라이언트에게 패킷으로 전송(DeukPack Binary)할 수 있습니다. 
DTO 복제 코드가 사라지면서 백엔드 코드의 양이 획기적으로 줄어듭니다.

## 결론: 개발자 생산성의 극대화

DeukPack은 '네트워크 라이브러리'의 한계를 넘어 '백엔드 아키텍처 전반을 관통하는 뼈대'로 동작합니다. DB 모델과 네트워크 모델의 일치, 이것이 DeukPack이 백엔드 개발자의 퇴근 시간을 앞당기는 핵심 비결입니다.