/** WireSerializer / WireDeserializer 공용: 값 타입 구분 (자기기술적 와이어) */
export const enum WireValueTag {
  Null = 0,
  False = 1,
  True = 2,
  Int32 = 3,
  Int64 = 4,
  Double = 5,
  String = 6,
  Binary = 7,
  Array = 8,
  Map = 9,
  Object = 10
}
