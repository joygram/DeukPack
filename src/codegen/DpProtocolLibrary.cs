/**
 * DeukPack Protocol Library — 모듈화됨.
 * 기존 단일 파일(2100+ 라인)을 아래 6개 파일로 분리. 이 파일은 빌드에서 제외됨.
 *
 * - DpProtocolCore.cs      인터페이스·와이어 타입·스키마·DpTypeNames
 * - DpBinaryProtocol.cs   바이너리 프로토콜 (ArrayPool·최적화)
 * - DpJsonProtocol.cs     JSON 프로토콜
 * - DeukPackCodec.cs 직렬화 헬퍼 (WriteValue, ReadValue, WriteList, ReadList 등)
 * - DpProtocolUtil.cs     Skip 등 유틸
 * - TBinaryProtocol.cs    Thrift 호환 별도 구현
 *
 * DeukPack.Protocol.csproj 에서는 위 6개만 Compile에 포함.
 */
