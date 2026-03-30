import { BinaryReader } from '../protocols/BinaryReader';
import { BinaryWriter } from '../protocols/BinaryWriter';
import { WireDeserializer } from '../serialization/WireDeserializer';
import { WireSerializer } from '../serialization/WireSerializer';

describe('DeukPack Security & Stability', () => {
  describe('BinaryReader Guards', () => {
    it('should throw when reading beyond buffer size', () => {
      const reader = new BinaryReader(new Uint8Array([1, 2, 3]));
      expect(() => reader.readI32()).toThrow('BinaryReader: need 4 byte(s)');
    });

    it('should throw on negative length prefixes', () => {
      const writer = new BinaryWriter();
      writer.writeI32(-1);
      const reader = new BinaryReader(writer.getBuffer());
      expect(() => reader.readString()).toThrow('BinaryReader: negative length');
    });

    it('should throw when length prefix exceeds MAX_SAFE_LENGTH', () => {
      const writer = new BinaryWriter();
      writer.writeI32(11 * 1024 * 1024); // 11MB
      const reader = new BinaryReader(writer.getBuffer());
      expect(() => reader.readString()).toThrow(/exceeds MAX_SAFE_LENGTH/);
    });

    it('should throw on invalid UTF-8 strings', () => {
      // Length 2 in LE: [2, 0, 0, 0]
      const raw = new Uint8Array([2, 0, 0, 0, 0xFF, 0xFE]); 
      const reader = new BinaryReader(raw);
      expect(() => reader.readString()).toThrow('BinaryReader: invalid UTF-8 string data');
    });
  });

  describe('WireDeserializer Recursion Limit', () => {
    it('should throw when recursion depth exceeds limit', () => {
      const serializer = new WireSerializer();
      // Create a deeply nested array
      let nested: any = [];
      for (let i = 0; i < 100; i++) {
        nested = [nested];
      }
      
      const options = { 
        protocol: 'pack' as const, 
        endianness: 'LE' as const,
        optimizeForSize: false,
        includeDefaultValues: false,
        validateTypes: false
      };
      const buffer = serializer.serialize(nested, options);
      const deserializer = new WireDeserializer();
      
      expect(() => deserializer.deserialize(buffer, Array, options))
        .toThrow(/recursion depth limit exceeded/);
    });
  });

  describe('BinaryWriter Guards', () => {
    it('should throw when writing strings exceeding MAX_SAFE_LENGTH', () => {
      const writer = new BinaryWriter();
      const largeString = 'a'.repeat(10 * 1024 * 1024 + 1); // 10MB + 1
      expect(() => writer.writeString(largeString)).toThrow(/exceeds MAX_SAFE_LENGTH/);
    });
  });
});
