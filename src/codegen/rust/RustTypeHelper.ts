import { DeukPackType } from '../../types/DeukPackTypes';

export class RustTypeHelper {
  public static toRustType(type: DeukPackType): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'bool';
        case 'byte': case 'int8': return 'i8';
        case 'int16': return 'i16';
        case 'int32': return 'i32';
        case 'int64': return 'i64';
        case 'float': return 'f32';
        case 'double': return 'f64';
        case 'string': return 'String';
        case 'binary': return 'Vec<u8>';
        default: return type; // Struct or Enum name
      }
    }

    switch (type.type) {
      case 'list':
      case 'array':
        return `Vec<${this.toRustType(type.elementType)}>`;
      case 'set':
        return `std::collections::HashSet<${this.toRustType(type.elementType)}>`;
      case 'map':
        return `std::collections::HashMap<${this.toRustType(type.keyType)}, ${this.toRustType(type.valueType)}>`;
      default:
        return 'String';
    }
  }

  public static toSnakeCase(name: string): string {
    return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  public static toPascalCase(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
