/**
 * Lexer NUMBER 토큰 값 → 숫자. 
 * JS Number (double) 정밀도 범위를 넘는 정수는 BigInt로 반환하여 64비트 정밀도를 유지한다.
 */
export function parseDeukNumericLiteral(text: string): number | bigint {
  const t = text.trim();
  // 16진수 접두어 처리
  if (/^0[xX][0-9a-fA-F]+$/.test(t)) {
    const val = BigInt(t);
    if (val > BigInt(Number.MAX_SAFE_INTEGER) || val < BigInt(Number.MIN_SAFE_INTEGER)) {
      return val;
    }
    return Number(val);
  }
  // 10진수 처리. . 혹은 e/E가 있으면 실수로 간주
  if (/[.eE]/.test(t)) {
    return parseFloat(t);
  }
  
  try {
    const val = BigInt(t);
    if (val > BigInt(Number.MAX_SAFE_INTEGER) || val < BigInt(Number.MIN_SAFE_INTEGER)) {
      return val;
    }
    return Number(val);
  } catch {
    return parseFloat(t);
  }
}
