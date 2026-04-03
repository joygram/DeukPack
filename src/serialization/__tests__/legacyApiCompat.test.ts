/**
 * Legacy API 하위호환 검증 (Deprecated Compat Only)
 * ──────────────────────────────────────────────────
 * 이 파일의 테스트는 레거시 메서드가 런타임 에러 없이 동작하는지만 확인합니다.
 * 신규 코드에서는 이 메서드들을 사용하지 마세요.
 * 표준 API는 packUnpackApi.test.ts 를 참고하세요.
 */
import { serialize, deserialize } from '../../index';

const sample = { id: 7, name: 'Legacy', hp: 50.0 };

describe('[compat] legacy API — deprecated aliases still work', () => {
  // serialize() → pack() 의 구 이름
  test('[compat] serialize (old: Serialize) still produces valid binary', () => {
    const bin  = serialize(sample, 'pack');
    const back = deserialize<typeof sample>(bin, 'pack');
    expect(back.id).toBe(sample.id);
  });

  // json serialize → 구 toJson/fromJson에 해당
  test('[compat] serialize json (old: toJson) still produces valid JSON', () => {
    const jsonBytes = serialize(sample, 'json');
    const text      = new TextDecoder().decode(jsonBytes);
    expect(() => JSON.parse(text)).not.toThrow();
    const back = deserialize<typeof sample>(jsonBytes, 'json');
    expect(back.name).toBe(sample.name);
  });

  // Buffer input → 구 fromBinary 에 해당
  test('[compat] deserialize accepts Buffer (old: fromBinary)', () => {
    if (typeof Buffer === 'undefined') return;
    const bin  = serialize(sample, 'pack');
    const back = deserialize<typeof sample>(Buffer.from(bin), 'pack');
    expect(back.id).toBe(sample.id);
  });

  // string input → 구 fromJson에 해당
  test('[compat] deserialize accepts JSON string (old: fromJson)', () => {
    const jsonBytes = serialize(sample, 'json');
    const text      = new TextDecoder().decode(jsonBytes);
    const back      = deserialize<typeof sample>(text, 'json');
    expect(back.name).toBe(sample.name);
  });
});
