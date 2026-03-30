# 05편: DeukPack의 심장, DpProtocol 파헤치기 (Thrift 호환과 메모리 최적화)

이전 아티클에서 DeukPack이 기존 Protobuf나 Thrift의 한계를 극복하기 위해 탄생했다고 이야기했습니다. 특히 DeukPack은 Thrift의 `TBinaryProtocol`과 호환되는 구조를 채택하면서도, 성능과 메모리 사용량을 극적으로 개선했습니다.

이번 편에서는 DeukPack의 심장이라 할 수 있는 `DpBinaryProtocol`이 어떻게 이것을 가능하게 했는지, 그 기술적인 비밀을 파헤쳐 보겠습니다.

## 레거시 라이브러리의 고통: 가비지 컬렉션(GC)

Apache Thrift의 공식 C# 라이브러리는 비교적 오래된 .NET 환경을 기준으로 설계되었습니다. 이로 인해 데이터를 직렬화하거나 역직렬화할 때마다 `new byte[]`와 같이 새로운 메모리 할당이 빈번하게 발생합니다.

초당 수백, 수천 개의 패킷을 처리해야 하는 실시간 게임 서버나 고성능 백엔드에서 이러한 잦은 메모리 할당은 가비지 컬렉터(GC)에게 큰 부담을 줍니다. GC가 동작하는 순간 애플리케이션은 짧게 '멈칫'하게 되는데(GC Spike), 이는 게임의 프레임 드랍이나 서비스 지연의 직접적인 원인이 됩니다.

## DeukPack의 해법: 현대적인 C# 메모리 관리 기법

`DpBinaryProtocol`은 Thrift와 동일한 바이트 스트림(Wire Format)을 생성하지만, 내부 구현은 메모리 효율을 극대화하기 위해 완전히 새롭게 작성되었습니다.

### 1. 버퍼 풀링 (`ArrayPool<T>`)

가장 핵심적인 최적화입니다. `DpBinaryProtocol`은 메시지를 쓸 때마다 새로운 `byte` 배열을 할당하는 대신, .NET에 내장된 `System.Buffers.ArrayPool<byte>.Shared`에서 버퍼를 '대여(Rent)'합니다. 작업이 끝나면 이 버퍼를 풀에 '반납(Return)'하여 다른 작업이 재사용할 수 있도록 합니다.

```csharp
// DpBinaryProtocol의 개념적 동작
public void WriteMessage(IDeukPackable message)
{
    // 새 할당(new byte[]) 대신 풀에서 버퍼를 빌립니다.
    byte[] buffer = ArrayPool<byte>.Shared.Rent(1024); 
    try
    {
        var protocol = new DpBinaryProtocol(new TMemoryBuffer(buffer));
        message.Write(protocol);
        
        // ... 네트워크로 버퍼의 사용된 부분만 전송 ...
    }
    finally
    {
        // 사용이 끝난 버퍼를 풀에 반납하여 재사용할 수 있게 합니다.
        ArrayPool<byte>.Shared.Return(buffer);
    }
}
```

이 간단한 변화만으로도 GC가 처리해야 할 메모리 쓰레기의 양이 극적으로 줄어들어, GC로 인한 성능 저하를 원천적으로 방지합니다.

### 2. 제로 카피 (Zero-Copy)와 `Span<T>`

데이터를 읽을 때도 마찬가지입니다. 네트워크 버퍼의 일부를 잘라내어 처리할 때 불필요한 복사를 피하기 위해 `Span<T>`과 `ReadOnlySequence<T>` 같은 현대적인 .NET API를 적극적으로 활용합니다. 이를 통해 메모리 복사 없이 버퍼의 특정 영역을 직접 읽고 처리하는 '제로 카피(Zero-Copy)'에 가까운 동작을 구현합니다.

## 결론: 호환성은 유지하되, 성능은 극대화

DeukPack은 Thrift와의 '호환성'이라는 안정적인 기반 위에, `ArrayPool`과 `Span<T>`이라는 현대적인 최적화 기법을 적용했습니다. 그 결과, 기존 Thrift 생태계와 연동하면서도 C# 기준 **약 10배 빠른 속도와 5배 적은 메모리 사용량**이라는 압도적인 성능을 달성할 수 있었습니다.

이는 DeukPack이 단순한 대체재가 아니라, 성능에 민감한 현대 애플리케이션 환경을 위한 진정한 '개선판'임을 보여주는 핵심적인 증거입니다.

---
> **다음 편 예고:**
> 다음 아티클 **[메모리 할당 0을 향하여: C# ArrayPool과 Zero-Copy 직렬화 기법]**에서는 5편에서 소개한 `ArrayPool`과 `Span<T>`을 이용한 메모리 최적화 기법을 좀 더 깊이 있게 다루고, 실제 코드에서 어떻게 적용하여 성능을 끌어올릴 수 있는지 구체적인 예시와 함께 살펴보겠습니다.