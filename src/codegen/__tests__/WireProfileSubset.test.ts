import {
  csharpSuffixFromProfile,
  fieldIncludedInWireProfile,
  filterStructFieldsForProfile,
  parseWireProfilesAnnotation,
  WIRE_PROFILES_ANNOTATION_KEY
} from '../WireProfileSubset';
import { DeukPackField, DeukPackStruct } from '../../types/DeukPackTypes';

describe('WireProfileSubset', () => {
  test('parseWireProfilesAnnotation reads wireProfiles and wire_profiles', () => {
    expect(parseWireProfilesAnnotation({ [WIRE_PROFILES_ANNOTATION_KEY]: 'client, admin' })).toEqual(['client', 'admin']);
    expect(parseWireProfilesAnnotation({ wire_profiles: 'A,B' })).toEqual(['a', 'b']);
    expect(parseWireProfilesAnnotation({})).toBeNull();
  });

  test('field without wireProfiles is included in every profile', () => {
    const f: DeukPackField = { id: 1, name: 'x', type: 'int32', required: false };
    expect(fieldIncludedInWireProfile(f, 'client')).toBe(true);
  });

  test('field with wireProfiles only matches listed profiles', () => {
    const f: DeukPackField = {
      id: 2,
      name: 'secret',
      type: 'string',
      required: false,
      annotations: { wireProfiles: 'server, admin' }
    };
    expect(fieldIncludedInWireProfile(f, 'server')).toBe(true);
    expect(fieldIncludedInWireProfile(f, 'client')).toBe(false);
  });

  test('filterStructFieldsForProfile', () => {
    const s: DeukPackStruct = {
      name: 'User',
      fields: [
        { id: 1, name: 'id', type: 'int32', required: true },
        { id: 2, name: 'email', type: 'string', required: false, annotations: { wireProfiles: 'client' } },
        { id: 3, name: 'hash', type: 'string', required: false, annotations: { wireProfiles: 'server' } }
      ]
    };
    const clientFields = filterStructFieldsForProfile(s, 'client');
    expect(clientFields.map((x) => x.name)).toEqual(['id', 'email']);
  });

  test('csharpSuffixFromProfile', () => {
    expect(csharpSuffixFromProfile('client')).toBe('_Client');
    expect(csharpSuffixFromProfile('internal-api')).toBe('_InternalApi');
  });
});
