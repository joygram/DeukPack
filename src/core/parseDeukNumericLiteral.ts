/**
 * Lexer NUMBER 토큰 값 → 숫자. 0x/0X 16진은 parseFloat가 0만 반환하는 문제를 피한다.
 */
export function parseDeukNumericLiteral(text: string): number {
  const t = text.trim();
  if (/^0[xX][0-9a-fA-F]+$/.test(t)) return parseInt(t, 16);
  return parseFloat(t);
}
