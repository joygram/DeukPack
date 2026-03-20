/**
 * Wire profile (subset) helpers: filter struct fields by IDL annotation wireProfiles.
 * Used by CSharpGenerator and documented in DEUKPACK_WIRE_PROFILE_SUBSET.md.
 */

import { DeukPackField, DeukPackStruct } from '../types/DeukPackTypes';

export const WIRE_PROFILES_ANNOTATION_KEY = 'wireProfiles';

/** Comma-separated profile tokens on a field; absent / empty = visible in every profile. */
export function parseWireProfilesAnnotation(annotations?: { [key: string]: string }): string[] | null {
  if (!annotations) return null;
  const raw = annotations[WIRE_PROFILES_ANNOTATION_KEY] ?? annotations['wire_profiles'];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function fieldIncludedInWireProfile(field: DeukPackField, profileLower: string): boolean {
  const list = parseWireProfilesAnnotation(field.annotations);
  if (list == null) return true;
  return list.includes(profileLower);
}

export function filterStructFieldsForProfile(struct: DeukPackStruct, profileLower: string): DeukPackField[] {
  return (struct.fields || []).filter((f) => fieldIncludedInWireProfile(f, profileLower));
}

/** e.g. client -> _Client, internal-api -> _InternalApi */
export function csharpSuffixFromProfile(profile: string): string {
  const parts = profile
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return '_Subset';
  return (
    '_' +
    parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')
  );
}
