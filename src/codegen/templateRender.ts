/**
 * Codegen text templates: placeholders @@KEY@@ (UPPER_SNAKE keys in map).
 */

export function applyCodegenPlaceholders(template: string, values: Record<string, string>): string {
  let out = template;
  for (const key of Object.keys(values)) {
    const token = `@@${key}@@`;
    out = out.split(token).join(values[key]!);
  }
  return out;
}
