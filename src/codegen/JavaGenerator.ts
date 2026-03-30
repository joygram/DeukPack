import { DeukPackAST, DeukPackEnum, DeukPackField, DeukPackType } from '../types/DeukPackTypes';
import { applyCodegenPlaceholders } from './templateRender';
import { CodegenTemplateHost } from './codegenTemplateHost';

/**
 * Java Code Generator for DeukPack
 * Supports Binary, Pack, and JSON protocols.
 */
export class JavaGenerator {
  private readonly _tpl = new CodegenTemplateHost('java');

  public async generate(ast: DeukPackAST, options: any): Promise<{ [filename: string]: string }> {
    const files: { [filename: string]: string } = {};
    const javaPackage = options.javaPackage || 'com.deukpack.generated';
    const packagePath = javaPackage.replace(/\./g, '/');

    // 1. Generate Structs
    for (const struct of ast.structs) {
      const filename = `${packagePath}/${struct.name}.java`;
      files[filename] = this.generateStruct(struct, ast, javaPackage);
    }

    // 2. Generate Enums
    for (const enm of ast.enums) {
      const filename = `${packagePath}/${enm.name}.java`;
      files[filename] = this.generateEnum(enm, javaPackage);
    }

    // 3. Copy Runtime Files (Protocols, DpMessage, etc.)
    const runtimeFiles = [
        'DpProtocol.java', 
        'DpBinaryProtocol.java', 
        'DpPackProtocol.java', 
        'DpJsonProtocol.java',
        'DpCompactProtocol.java',
        'DpTJSONProtocol.java',
        'DpMessage.java',
        'DpRecord.java',
        'DpColumn.java',
        'DpList.java',
        'DpDict.java',
        'DpSet.java',
        'DpWireType.java',
        'IDeukPack.java'
    ];
    
    for (const file of runtimeFiles) {
        const content = this._tpl.load(`${file}.tpl`);
        files[`${packagePath}/${file}`] = applyCodegenPlaceholders(content, { JAVA_PACKAGE: javaPackage });
    }

    return files;
  }

  private generateStruct(struct: any, ast: DeukPackAST, javaPackage: string): string {
    const fields = struct.fields as DeukPackField[];
    const extendsClause = struct.extends ? ` extends ${struct.extends}` : '';
    
    const fieldDeclarations = fields.map(f => {
        const type = this.toJavaType(f.type, ast, javaPackage);
        return `    private ${type} ${f.name}${this.renderDefaultValue(f)};`;
    }).join('\n');

    const constructorInitialization = fields.map(f => `        this.${f.name} = ${f.name};`).join('\n');

    const gettersSetters = fields.map(f => {
        const type = this.toJavaType(f.type, ast, javaPackage);
        const capitalized = f.name.charAt(0).toUpperCase() + f.name.slice(1);
        return `    public ${type} get${capitalized}() { return ${f.name}; }\n` +
               `    public void set${capitalized}(${type} ${f.name}) { this.${f.name} = ${f.name}; }`;
    }).join('\n\n');

    const nonNullCount = fields.map(f => `(this.${f.name} != null ? 1 : 0)`).join(' + ');

    const writeBody = fields.map(f => {
        return `        if (this.${f.name} != null) {\n` +
               `            oprot.writeFieldBegin(new DpColumn("${f.name}", DpWireType.${this.toWireType(f.type, ast)}, (short)${f.id}));\n` +
               `            ${this.renderWriteCall(f, 'this.' + f.name, ast, javaPackage)}\n` +
               `            oprot.writeFieldEnd();\n` +
               `        }`;
    }).join('\n');

    const readSwitchCases = fields.map(f => {
        return `                case ${f.id}:\n` +
               `                    if (field.Type == DpWireType.${this.toWireType(f.type, ast)} || field.Type == DpWireType.Void) {\n` +
               `                        ${this.renderReadCall(f, 'this.' + f.name, ast, javaPackage)}\n` +
               `                    } else {\n` +
               `                        iprot.skip(field.Type);\n` +
               `                    }\n` +
               `                    break;`;
    }).join('\n');

    const nameToIdLogic = fields.map(f => 
        `            if (id == 0 && "${f.name}".equals(field.Name)) id = ${f.id};`
    ).join('\n');

    const validateBody = fields.map(f => {
        if (f.required) {
            return `        if (this.${f.name} == null) throw new RuntimeException("Missing required field: ${f.name}");`;
        }
        return ``;
    }).filter(Boolean).join('\n');

    const toStringBody = fields.map((f, i) => {
        const prefix = i === 0 ? '' : 'sb.append(", "); ';
        return `        ${prefix}sb.append("${f.name}:").append(this.${f.name});`;
    }).join('\n');

    const equalsBody = fields.map(f => `Objects.equals(this.${f.name}, that.${f.name})`).join(' && ');
    const hashCodeBody = fields.map(f => `this.${f.name}`).join(', ');

    const cloneBody = fields.map(f => {
        const type = this.toJavaType(f.type, ast, javaPackage);
        if (type.startsWith('List<') || type.startsWith('ArrayList<')) return `            if (this.${f.name} != null) cloned.${f.name} = new ArrayList<>(this.${f.name});`;
        if (type.startsWith('Set<') || type.startsWith('HashSet<')) return `            if (this.${f.name} != null) cloned.${f.name} = new HashSet<>(this.${f.name});`;
        if (type.startsWith('Map<') || type.startsWith('HashMap<')) return `            if (this.${f.name} != null) cloned.${f.name} = new HashMap<>(this.${f.name});`;
        return ``;
    }).filter(Boolean).join('\n');

    const structTpl = this._tpl.load('Struct.java.tpl');
    return applyCodegenPlaceholders(structTpl, {
        JAVA_PACKAGE: javaPackage,
        STRUCT_NAME: struct.name,
        DOC_COMMENT: struct.docComment || `Generated Struct: ${struct.name}`,
        FIELD_DECLARATIONS: fieldDeclarations,
        CONSTRUCTOR_INITIALIZATION: constructorInitialization,
        GETTERS_SETTERS: gettersSetters,
        NON_NULL_COUNT: nonNullCount || '0',
        WRITE_BODY: writeBody,
        READ_SWITCH_CASES: readSwitchCases,
        NAME_TO_ID_LOGIC: nameToIdLogic,
        VALIDATE_BODY: validateBody,
        TO_STRING_BODY: toStringBody,
        EQUALS_BODY: equalsBody || 'true',
        HASH_CODE_BODY: hashCodeBody || '',
        CLONE_BODY: cloneBody,
        EXTENDS: extendsClause,
    });
  }

  private generateEnum(enm: DeukPackEnum, javaPackage: string): string {
      const enumValues = Object.entries(enm.values).map(([name, value]) => `    ${name}(${value})`).join(',\n') + ';';
      const enumTpl = this._tpl.load('Enum.java.tpl');
      return applyCodegenPlaceholders(enumTpl, {
          JAVA_PACKAGE: javaPackage,
          ENUM_NAME: enm.name,
          DOC_COMMENT: enm.docComment || `Generated Enum: ${enm.name}`,
          ENUM_VALUES: enumValues
      });
  }

  private toJavaType(type: DeukPackType, ast: DeukPackAST, ns: string): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'Boolean';
        case 'byte': case 'int8': return 'Byte';
        case 'int16': return 'Short';
        case 'int32': return 'Integer';
        case 'int64': return 'Long';
        case 'float': return 'Float';
        case 'double': return 'Double';
        case 'string': return 'String';
        case 'binary': return 'byte[]';
        case 'record': return 'Object';
        case 'enum': return 'Integer';
        default: return type;
      }
    }
    
    if (type.type === 'list' || type.type === 'array') {
        return `List<${this.toJavaTypeForGeneric(type.elementType, ast, ns)}>`;
    }
    if (type.type === 'set') {
        return `Set<${this.toJavaTypeForGeneric(type.elementType, ast, ns)}>`;
    }
    if (type.type === 'map') {
        const kt = this.toJavaTypeForGeneric(type.keyType, ast, ns);
        const vt = this.toJavaTypeForGeneric(type.valueType, ast, ns);
        return `Map<${kt}, ${vt}>`;
    }
    return 'Object';
  }

  private toJavaTypeForGeneric(type: DeukPackType, ast: DeukPackAST, ns: string): string {
    const t = this.toJavaType(type, ast, ns);
    if (t === 'byte[]') return 'byte[]';
    return t;
  }

  private toWireType(type: DeukPackType, ast: DeukPackAST): string {
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
        case 'bool': return 'Bool';
        case 'byte': case 'int8': return 'Byte';
        case 'int16': return 'Int16';
        case 'int32': return 'Int32';
        case 'int64': return 'Int64';
        case 'float': case 'double': return 'Double';
        case 'string':
        case 'binary': return 'String';
        case 'list': case 'array': return 'List';
        case 'set': return 'Set';
        case 'map': return 'Map';
        case 'record': return 'Struct';
        case 'enum': return 'Int32';
        default: 
            if (typeof type === 'string' && this.isEnum(type, ast)) return 'Int32';
            return 'Struct';
    }
  }

  private renderDefaultValue(f: DeukPackField): string {
      if (f.defaultValue === undefined) return '';
      const v = f.defaultValue;
      const t = typeof f.type === 'string' ? f.type : f.type.type;
      switch (t) {
          case 'string': return ` = "${v}"`;
          case 'bool': return ` = ${v}`;
          case 'int8': case 'byte': return ` = (byte) ${v}`;
          case 'int16': return ` = (short) ${v}`;
          case 'int32': return ` = ${v}`;
          case 'int64': return ` = ${v}L`;
          case 'float': return ` = ${v}f`;
          case 'double': return ` = ${v}d`;
          default: return '';
      }
  }

  private isEnum(type: DeukPackType, ast: DeukPackAST): boolean {
    const t = typeof type === 'string' ? type : type.type;
    return ast.enums.some(e => e.name === t || (e as any).fullName === t);
  }

  private renderWriteCall(f: DeukPackField, varName: string, ast: DeukPackAST, ns: string): string {
    const type = f.type;
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
        case 'bool': return `oprot.writeBool(${varName});`;
        case 'byte': case 'int8': return `oprot.writeByte(${varName});`;
        case 'int16': return `oprot.writeI16(${varName});`;
        case 'int32': return `oprot.writeI32(${varName});`;
        case 'int64': return `oprot.writeI64(${varName});`;
        case 'float': case 'double': return `oprot.writeDouble(${varName});`;
        case 'string': return `oprot.writeString(${varName});`;
        case 'binary': return `oprot.writeBinary(${varName});`;
        case 'enum': return `oprot.writeI32(${varName}.getValue());`;
        case 'record': return `${varName}.write(oprot);`;
        case 'list': case 'array': {
            const listItemType = (type as any).elementType;
            return `oprot.writeListBegin(new DpList(DpWireType.${this.toWireType(listItemType, ast)}, ${varName}.size()));\n` +
                   `            for (${this.toJavaTypeForGeneric(listItemType, ast, ns)} _item : ${varName}) {\n` +
                   `                ${this.renderWriteValue(listItemType, '_item', ast, ns)}\n` +
                   `            }\n` +
                   `            oprot.writeListEnd();`;
        }
        case 'map': {
            const kt = (type as any).keyType;
            const vt = (type as any).valueType;
            return `oprot.writeMapBegin(new DpDict(DpWireType.${this.toWireType(kt, ast)}, DpWireType.${this.toWireType(vt, ast)}, ${varName}.size()));\n` +
                   `            for (Map.Entry<${this.toJavaTypeForGeneric(kt, ast, ns)}, ${this.toJavaTypeForGeneric(vt, ast, ns)}> _entry : ${varName}.entrySet()) {\n` +
                   `                ${this.renderWriteValue(kt, '_entry.getKey()', ast, ns)}\n` +
                   `                ${this.renderWriteValue(vt, '_entry.getValue()', ast, ns)}\n` +
                   `            }\n` +
                   `            oprot.writeMapEnd();`;
        }
        default: 
            if (typeof type === 'string') {
                if (this.isEnum(type, ast)) return `oprot.writeI32(${varName}.getValue());`;
                return `${varName}.write(oprot);`;
            }
            return `// unknown type ${t}`;
    }
  }

  private renderWriteValue(type: DeukPackType, varName: string, ast: DeukPackAST, _ns: string): string {
      const t = typeof type === 'string' ? type : type.type;
      switch (t) {
          case 'bool': return `oprot.writeBool(${varName});`;
          case 'byte': case 'int8': return `oprot.writeByte(${varName});`;
          case 'int16': return `oprot.writeI16(${varName});`;
          case 'int32': return `oprot.writeI32(${varName});`;
          case 'int64': return `oprot.writeI64(${varName});`;
          case 'float': case 'double': return `oprot.writeDouble(${varName});`;
          case 'string': return `oprot.writeString(${varName});`;
          case 'binary': return `oprot.writeBinary(${varName});`;
          case 'record': return `${varName}.write(oprot);`;
          default: 
            if (typeof type === 'string') {
                if (this.isEnum(type, ast)) return `oprot.writeI32(${varName}.getValue());`;
                return `${varName}.write(oprot);`;
            }
            return `// TODO: ${t}`;
      }
  }

  private renderReadCall(f: DeukPackField, varName: string, ast: DeukPackAST, ns: string): string {
    const type = f.type;
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
        case 'bool': return `${varName} = iprot.readBool();`;
        case 'byte': case 'int8': return `${varName} = iprot.readByte();`;
        case 'int16': return `${varName} = iprot.readI16();`;
        case 'int32': return `${varName} = iprot.readI32();`;
        case 'int64': return `${varName} = iprot.readI64();`;
        case 'float': return `${varName} = (float) iprot.readDouble();`;
        case 'double': return `${varName} = iprot.readDouble();`;
        case 'string': return `${varName} = iprot.readString();`;
        case 'binary': return `${varName} = iprot.readBinary();`;
        case 'enum': return `${varName} = ${this.toJavaType(type, ast, ns)}.findByValue(iprot.readI32());`;
        case 'record': return `${varName} = new ${this.toJavaType(type, ast, ns)}();\n                        ${varName}.read(iprot);`;
        case 'list': case 'array': {
            const listItemType = (type as any).elementType;
            const itemJavaType = this.toJavaTypeForGeneric(listItemType, ast, ns);
            return `{ DpList _list = iprot.readListBegin();\n` +
                   `                        ${varName} = new ArrayList<>(_list.Count);\n` +
                   `                        for (int _i = 0; _i < _list.Count; _i++) {\n` +
                   `                            ${itemJavaType} _item = ${this.renderReadValue(listItemType, ast, ns)};\n` +
                   `                            ${varName}.add(_item);\n` +
                   `                        }\n` +
                   `                        iprot.readListEnd(); }`;
        }
        case 'map': {
            const kt = (type as any).keyType;
            const vt = (type as any).valueType;
            const kJavaType = this.toJavaTypeForGeneric(kt, ast, ns);
            const vJavaType = this.toJavaTypeForGeneric(vt, ast, ns);
            return `{ DpDict _dict = iprot.readMapBegin();\n` +
                   `                        ${varName} = new HashMap<>(_dict.Count);\n` +
                   `                        for (int _i = 0; _i < _dict.Count; _i++) {\n` +
                   `                            ${kJavaType} _key = ${this.renderReadValue(kt, ast, ns)};\n` +
                   `                            ${vJavaType} _val = ${this.renderReadValue(vt, ast, ns)};\n` +
                   `                            ${varName}.put(_key, _val);\n` +
                   `                        }\n` +
                   `                        iprot.readMapEnd(); }`;
        }
        default: 
            if (typeof type === 'string') {
                if (this.isEnum(type, ast)) return `${varName} = ${this.toJavaType(type, ast, ns)}.findByValue(iprot.readI32());`;
                return `${varName} = new ${this.toJavaType(type, ast, ns)}();\n                        ${varName}.read(iprot);`;
            }
            return `// unknown type ${t}`;
    }
  }

  private renderReadValue(type: DeukPackType, ast: DeukPackAST, ns: string): string {
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
        case 'bool': return `iprot.readBool()`;
        case 'byte': case 'int8': return `iprot.readByte()`;
        case 'int16': return `iprot.readI16()`;
        case 'int32': return `iprot.readI32()`;
        case 'int64': return `iprot.readI64()`;
        case 'float': return `(float) iprot.readDouble()`;
        case 'double': return `iprot.readDouble()`;
        case 'string': return `iprot.readString()`;
        case 'binary': return `iprot.readBinary()`;
        default: 
            if (typeof type === 'string') {
                const javaType = this.toJavaType(type, ast, ns);
                if (this.isEnum(type, ast)) return `${javaType}.findByValue(iprot.readI32())`;
                return `(new ${javaType}()).readReturn(iprot)`;
            }
            return `null`;
    }
  }
}
