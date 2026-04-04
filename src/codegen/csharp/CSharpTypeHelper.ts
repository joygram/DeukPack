import { DeukPackAST, DeukPackStruct, DeukPackType } from '../../types/DeukPackTypes';

export class CSharpTypeHelper {
  public static capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  public static escapeCSharpString(s: string): string {
    return JSON.stringify(s);
  }

  public static escapeCSharpStringContent(s: string): string {
    return s.replace(/"/g, '""');
  }

  public static getStructNamespace(s: DeukPackStruct, _ast: DeukPackAST): string {
    return (s as any).namespace || '';
  }

  public static getStructFullName(s: DeukPackStruct, ast: DeukPackAST): string {
    const ns = this.getStructNamespace(s, ast);
    return ns ? `${ns}.${s.name}` : s.name;
  }

  public static getCSharpType(type: DeukPackType, ast?: DeukPackAST, ns?: string): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'bool';
        case 'byte': case 'int8': return 'sbyte';
        case 'int16': return 'short';
        case 'int32': return 'int';
        case 'int64': return 'long';
        case 'float': return 'float';
        case 'double': return 'double';
        case 'string': return 'string';
        case 'binary': return 'byte[]';
        case 'datetime': return 'DateTime';
        case 'timestamp': return 'long';
        default: return type;
      }
    }
    if (type.type === 'list' || type.type === 'array') return `List<${this.getCSharpType(type.elementType, ast, ns)}>`;
    if (type.type === 'set') return `HashSet<${this.getCSharpType(type.elementType, ast, ns)}>`;
    if (type.type === 'map') return `Dictionary<${this.getCSharpType(type.keyType, ast, ns)}, ${this.getCSharpType(type.valueType, ast, ns)}>`;
    return 'object';
  }

  public static getTType(type: DeukPackType, _ast?: DeukPackAST, _ns?: string): string {
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
      case 'bool': return 'DpWireType.Bool';
      case 'byte': case 'int8': return 'DpWireType.Byte';
      case 'int16': return 'DpWireType.Int16';
      case 'int32': return 'DpWireType.Int32';
      case 'int64': return 'DpWireType.Int64';
      case 'float': case 'double': return 'DpWireType.Double';
      case 'string': return 'DpWireType.String';
      case 'binary': return 'DpWireType.Binary';
      case 'list': case 'array': return 'DpWireType.List';
      case 'set': return 'DpWireType.Set';
      case 'map': return 'DpWireType.Map';
      default: {
        if (_ast && typeof type === 'string' && _ast.enums && _ast.enums.find(e => e.name === type)) {
          return 'DpWireType.Int32';
        }
        return 'DpWireType.Struct';
      }
    }
  }

  public static getSchemaType(type: DeukPackType, _ast?: DeukPackAST, _ns?: string): string {
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
      case 'bool': return 'DpSchemaType.Bool';
      case 'byte': case 'int8': return 'DpSchemaType.Byte';
      case 'int16': return 'DpSchemaType.Int16';
      case 'int32': return 'DpSchemaType.Int32';
      case 'int64': return 'DpSchemaType.Int64';
      case 'float': case 'double': return 'DpSchemaType.Double';
      case 'string': return 'DpSchemaType.String';
      case 'binary': return 'DpSchemaType.Binary';
      case 'list': case 'array': return 'DpSchemaType.List';
      case 'set': return 'DpSchemaType.Set';
      case 'map': return 'DpSchemaType.Map';
      default: {
        if (_ast && typeof type === 'string' && _ast.enums && _ast.enums.find(e => e.name === type)) {
          return 'DpSchemaType.Enum';
        }
        return 'DpSchemaType.Struct';
      }
    }
  }

  public static findDeukBracketTagValue(attrs: string[] | undefined, baseNameLower: string): string | undefined {
    if (!attrs) return undefined;
    for (const t of attrs) {
      const parts = t.split(':');
      const head = (parts[0] || '').split('(')[0]?.trim().toLowerCase();
      if (head === baseNameLower) {
        if (parts.length < 2) return '';
        return parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
      }
    }
    return undefined;
  }

  public static isMetaContainerStruct(struct: DeukPackStruct): boolean {
    return !!struct.annotations?.['table'] || !!struct.annotations?.['meta'];
  }
}
