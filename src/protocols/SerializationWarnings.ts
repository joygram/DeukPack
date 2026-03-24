/**
 * DeukPack serialization warnings — column missing or unknown field.
 * Call from generated or hand-written read loops (e.g. default case in switch on field.id).
 */

export type SerializationWarnCallback = (structName: string, fieldIdOrName: string | number, fieldName?: string) => void;

let _onUnknownField: SerializationWarnCallback | null = null;
let _onMissingRequired: ((structName: string, fieldName: string) => void) | null = null;

/**
 * Set custom logger for unknown-field warnings. Default: console.warn.
 */
export function setOnUnknownField(cb: SerializationWarnCallback | null): void {
  _onUnknownField = cb;
}

/**
 * Set custom logger for missing-required-field warnings. Default: console.warn.
 */
export function setOnMissingRequired(cb: ((structName: string, fieldName: string) => void) | null): void {
  _onMissingRequired = cb;
}

/**
 * Emit warning when stream contains a field not in the current struct schema (e.g. default case in read switch).
 */
export function logUnknownField(structName: string, fieldId: number, fieldName?: string): void {
  if (_onUnknownField) {
    _onUnknownField(structName, fieldId, fieldName);
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[DeukPack] Unknown field: struct=${structName}, fieldId=${fieldId}${fieldName != null ? `, fieldName=${fieldName}` : ''}`
    );
  }
}

/**
 * Emit warning when a required field was not present in the stream.
 */
export function logMissingRequiredField(structName: string, fieldName: string): void {
  if (_onMissingRequired) {
    _onMissingRequired(structName, fieldName);
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[DeukPack] Missing required field: struct=${structName}, fieldName=${fieldName}`);
  }
}
