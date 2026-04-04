import { DeukPackAST, DeukPackEnum, DeukPackField, DeukPackType } from '../types/DeukPackTypes';
import { applyCodegenPlaceholders } from './templateRender';
import { CodegenTemplateHost } from './codegenTemplateHost';

/**
 * Python Code Generator for DeukPack
 * Generates @dataclass based structs or TypedDict based dicts.
 */
export class PythonGenerator {
  private readonly _tpl = new CodegenTemplateHost('python');

  public async generate(ast: DeukPackAST, options: any): Promise<{ [filename: string]: string }> {
    const files: { [filename: string]: string } = {};
    const pythonNamespace = options.pythonNamespace || 'deukpack_generated';
    const pkgPath = pythonNamespace.replace(/\./g, '/');
    const useDict = options.pythonUseDict === true;

    // 1. Generate Structs
    for (const struct of ast.structs) {
      const filename = `${pkgPath}/${this.toSnakeCase(struct.name)}.py`;
      if (useDict) {
        files[filename] = this.generateTypedDictStruct(struct, ast, pythonNamespace, options);
      } else {
        files[filename] = this.generateStruct(struct, ast, pythonNamespace, options);
      }
    }

    // 2. Generate Enums
    for (const enm of ast.enums) {
      const filename = `${pkgPath}/${this.toSnakeCase(enm.name)}.py`;
      files[filename] = this.generateEnum(enm, pythonNamespace);
    }

    // 3. Create Runtime files
    const runtimeFiles = ['__init__.py', 'dp_protocol.py', 'dp_wire_type.py'];
    for (const rf of runtimeFiles) {
      const content = this._tpl.load(`${rf}.tpl`);
      files[`${pkgPath}/runtime/${rf}`] = applyCodegenPlaceholders(content, { PYTHON_NAMESPACE: pythonNamespace });
    }

    // 4. Create package init
    files[`${pkgPath}/__init__.py`] = 'from .runtime import DpProtocol, DpWireType\n';

    return files;
  }

  private getRequiredImports(struct: any): Set<string> {
    const imports = new Set<string>();
    const fields = struct.fields as DeukPackField[];
    for (const f of fields) {
      this.collectTypeImports(f.type, imports);
    }
    // Remove self-reference
    imports.delete(struct.name);
    return imports;
  }

  private collectTypeImports(type: DeukPackType, imports: Set<string>) {
    if (typeof type === 'string') {
      if (!['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'float', 'double', 'string', 'binary'].includes(type)) {
        imports.add(type);
      }
    } else {
      if (type.type === 'list' || type.type === 'array' || type.type === 'set') {
        this.collectTypeImports(type.elementType, imports);
      } else if (type.type === 'map') {
        this.collectTypeImports(type.keyType, imports);
        this.collectTypeImports(type.valueType, imports);
      }
    }
  }

  private renderImports(requiredTypes: Set<string>, useDict: boolean): string {
    let lines = '';
    for (const t of requiredTypes) {
      const snake = this.toSnakeCase(t);
      if (useDict) {
        lines += `from .${snake} import ${t}, ${t}Codec\n`;
      } else {
        lines += `from .${snake} import ${t}\n`;
      }
    }
    return lines;
  }

  private generateStruct(struct: any, ast: DeukPackAST, ns: string, options: any): string {
    const fields = struct.fields as DeukPackField[];
    const requiredImports = this.getRequiredImports(struct);
    const importLines = this.renderImports(requiredImports, false);
    const pyVer = parseFloat(options.pythonVersion || '3.10');

    const fieldDefs = fields.map(f => `    ${this.toSnakeCase(f.name)}: ${this.toPythonType(f.type, ast, ns)}${this.renderDefaultValue(f, ast)}`).join('\n');
    
    // Default the pack and unpack items to DeukPack standard if needed
    const packBody = fields.map(f => {
        const fieldName = this.toSnakeCase(f.name);
        return `        if self.${fieldName} is not None:\n` +
               `            prot.write_field_begin(DpWireType.${this.toWireType(f.type, ast)}, ${f.id})\n` +
               `            ${this.renderPackCall(f, ast, 'self.' + fieldName, false, options)}`;
    }).join('\n\n');

    const unpackCases = fields.map(f => `            elif field_id == ${f.id}:\n` +
               `                if wire_type == DpWireType.${this.toWireType(f.type, ast)}:\n` +
               `                    ${this.renderUnpackCall(f, ast, 'self.' + this.toSnakeCase(f.name), false, options)}\n` +
               `                else:\n` +
               `                    prot.skip(wire_type)`).join('\n');

    return applyCodegenPlaceholders(this._tpl.load('struct_class.py.tpl'), {
        IMPORTS: importLines,
        DATACLASS_DECORATOR: pyVer >= 3.10 ? '@dataclass(slots=True)' : '@dataclass',
        STRUCT_NAME: struct.name,
        DOC_COMMENT: struct.docComment || `DeukPack Generated Struct: ${struct.name}`,
        FIELD_DECLARATIONS: fieldDefs,
        PACK_BODY: packBody,
        UNPACK_BODY: unpackCases || '            prot.skip(wire_type)'
    });
  }

  private generateTypedDictStruct(struct: any, ast: DeukPackAST, ns: string, options: any): string {
    const fields = struct.fields as DeukPackField[];
    const requiredImports = this.getRequiredImports(struct);
    const importLines = this.renderImports(requiredImports, true);

    const fieldDefs = fields.map(f => `    ${this.toSnakeCase(f.name)}: ${this.toPythonType(f.type, ast, ns)}`).join('\n');

    const packBody = fields.map(f => {
        const fieldName = this.toSnakeCase(f.name);
        return `        if obj.get('${fieldName}') is not None:\n` +
               `            prot.write_field_begin(DpWireType.${this.toWireType(f.type, ast)}, ${f.id})\n` +
               `            ${this.renderPackCall(f, ast, "obj['" + fieldName + "']", true, options)}`;
    }).join('\n\n');

    const unpackCases = fields.map(f => {
        const fieldName = this.toSnakeCase(f.name);
        return `            elif field_id == ${f.id}:\n` +
               `                if wire_type == DpWireType.${this.toWireType(f.type, ast)}:\n` +
               `                    ${this.renderUnpackCall(f, ast, "obj['" + fieldName + "']", true, options)}\n` +
               `                else:\n` +
               `                    prot.skip(wire_type)`;
    }).join('\n');

    return applyCodegenPlaceholders(this._tpl.load('typed_dict_struct.py.tpl'), {
        IMPORTS: importLines,
        STRUCT_NAME: struct.name,
        DOC_COMMENT: struct.docComment || `DeukPack Generated TypedDict: ${struct.name}`,
        FIELD_DECLARATIONS: fieldDefs,
        PACK_BODY: packBody,
        UNPACK_BODY: unpackCases || '            prot.skip(wire_type)'
    });
  }

  private generateEnum(enm: DeukPackEnum, _ns: string): string {
    const values = Object.entries(enm.values).map(([name, value]) => `    ${name} = ${value}`).join('\n');
    return applyCodegenPlaceholders(this._tpl.load('enum_class.py.tpl'), {
        ENUM_NAME: enm.name,
        DOC_COMMENT: enm.docComment || `DeukPack Generated Enum: ${enm.name}`,
        ENUM_VALUES: values
    });
  }

  private toPythonType(type: DeukPackType, ast: DeukPackAST, ns: string): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'bool';
        case 'byte': case 'int8':
        case 'int16': case 'int32': case 'int64': return 'int';
        case 'float': case 'double': return 'float';
        case 'string': return 'str';
        case 'binary': return 'bytes';
        default: return `'${type}'`;
      }
    }
    if (type.type === 'list' || type.type === 'array') return `List[${this.toPythonType(type.elementType, ast, ns)}]`;
    if (type.type === 'set') return `Set[${this.toPythonType(type.elementType, ast, ns)}]`;
    if (type.type === 'map') return `Dict[${this.toPythonType(type.keyType, ast, ns)}, ${this.toPythonType(type.valueType, ast, ns)}]`;
    return 'Any';
  }

  private toWireType(type: DeukPackType, _ast: DeukPackAST): string {
    const t = typeof type === 'string' ? type : type.type;
    switch (t) {
      case 'bool': return 'BOOL';
      case 'byte': case 'int8': return 'BYTE';
      case 'int16': return 'INT16';
      case 'int32': return 'INT32';
      case 'int64': return 'INT64';
      case 'float': case 'double': return 'DOUBLE';
      case 'string': return 'STRING';
      case 'binary': return 'BINARY';
      case 'list': case 'array': return 'LIST';
      case 'set': return 'SET';
      case 'map': return 'MAP';
      default: {
        const isEnum = _ast.enums.some((e: DeukPackEnum) => e.name === t);
        if (isEnum) return 'INT32';
        return 'STRUCT';
      }
    }
  }

  private renderDefaultValue(f: DeukPackField, ast: DeukPackAST): string {
    if (f.defaultValue === undefined) {
       if (typeof f.type !== 'string') {
          if (f.type.type === 'list' || f.type.type === 'array') return ' = field(default_factory=list)';
          if (f.type.type === 'set') return ' = field(default_factory=set)';
          if (f.type.type === 'map') return ' = field(default_factory=dict)';
       }
       return ' = None';
    }
    const v = f.defaultValue;
    if (typeof f.type === 'string') {
        if (f.type === 'string') return ` = "${v}"`;
        if (f.type === 'bool') return ` = ${v ? 'True' : 'False'}`;
        const isEnum = ast.enums.some((e: DeukPackEnum) => e.name === f.type);
        if (isEnum) return ` = ${f.type}.${v}`;
    }
    return ` = ${v}`;
  }

  private renderPackCall(f: DeukPackField, ast: DeukPackAST, varName: string, useDict: boolean, options: any): string {
    const t = f.type;
    if (typeof t === 'string') {
      switch (t) {
        case 'bool': return `prot.write_bool(${varName})`;
        case 'byte': case 'int8': return `prot.write_byte(${varName})`;
        case 'int16': return `prot.write_int16(${varName})`;
        case 'int32': return `prot.write_int32(${varName})`;
        case 'int64': return `prot.write_int64(${varName})`;
        case 'float': case 'double': return `prot.write_double(${varName})`;
        case 'string': return `prot.write_string(${varName})`;
        case 'binary': return `prot.write_binary(${varName})`;
        default: {
            const isEnum = ast.enums.some((e: DeukPackEnum) => e.name === t);
            if (isEnum) return `prot.write_int32(${varName}.value)`;
            return useDict ? `${t}Codec.serialize(${varName}, prot)` : `${varName}.serialize(prot)`;
        }
      }
    }
    if (t.type === 'list' || t.type === 'array') {
      const et = this.toWireType(t.elementType, ast);
      const writeCall = this.renderPackItemCall(t.elementType, ast, '_item', useDict, options);
      return `prot.write_list_begin(DpWireType.${et}, len(${varName})); [${writeCall} for _item in ${varName}]`;
    }
    if (t.type === 'set') {
      const et = this.toWireType(t.elementType, ast);
      const writeCall = this.renderPackItemCall(t.elementType, ast, '_item', useDict, options);
      return `prot.write_set_begin(DpWireType.${et}, len(${varName})); [${writeCall} for _item in dict.fromkeys(${varName}).keys()]`;
    }
    if (t.type === 'map') {
      const kt = this.toWireType(t.keyType, ast);
      const vt = this.toWireType(t.valueType, ast);
      const writeKey = this.renderPackItemCall(t.keyType, ast, '_key', useDict, options);
      const writeVal = this.renderPackItemCall(t.valueType, ast, '_val', useDict, options);
      return `prot.write_map_begin(DpWireType.${kt}, DpWireType.${vt}, len(${varName})); [(${writeKey}, ${writeVal}) for _key, _val in ${varName}.items()]`;
    }
    return useDict ? `${t.type}Codec.serialize(${varName}, prot)` : `${varName}.serialize(prot)`;
  }

  private renderPackItemCall(type: DeukPackType, ast: DeukPackAST, varName: string, useDict: boolean, options: any): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return `prot.write_bool(${varName})`;
        case 'byte': case 'int8': return `prot.write_byte(${varName})`;
        case 'int16': return `prot.write_int16(${varName})`;
        case 'int32': return `prot.write_int32(${varName})`;
        case 'int64': return `prot.write_int64(${varName})`;
        case 'float': case 'double': return `prot.write_double(${varName})`;
        case 'string': return `prot.write_string(${varName})`;
        case 'binary': return `prot.write_binary(${varName})`;
        default: {
            const isEnum = ast.enums.some((e: DeukPackEnum) => e.name === type);
            if (isEnum) return `prot.write_int32(${varName}.value)`;
            return useDict ? `${type}Codec.serialize(${varName}, prot)` : `${varName}.serialize(prot)`;
        }
      }
    }
    if (type.type === 'list' || type.type === 'array') {
      const et = this.toWireType(type.elementType, ast);
      const writeCall = this.renderPackItemCall(type.elementType, ast, '_item', useDict, options);
      return `(prot.write_list_begin(DpWireType.${et}, len(${varName})), [${writeCall} for _item in ${varName}])`;
    }
    if (type.type === 'set') {
      const et = this.toWireType(type.elementType, ast);
      const writeCall = this.renderPackItemCall(type.elementType, ast, '_item', useDict, options);
      return `(prot.write_set_begin(DpWireType.${et}, len(${varName})), [${writeCall} for _item in dict.fromkeys(${varName}).keys()])`;
    }
    if (type.type === 'map') {
      const kt = this.toWireType(type.keyType, ast);
      const vt = this.toWireType(type.valueType, ast);
      const writeKey = this.renderPackItemCall(type.keyType, ast, '_key', useDict, options);
      const writeVal = this.renderPackItemCall(type.valueType, ast, '_val', useDict, options);
      return `(prot.write_map_begin(DpWireType.${kt}, DpWireType.${vt}, len(${varName})), [( ${writeKey}, ${writeVal} ) for _key, _val in ${varName}.items()])`;
    }
    return useDict ? `${type.type}Codec.serialize(${varName}, prot)` : `${varName}.serialize(prot)`;
  }

  private renderUnpackCall(f: DeukPackField, ast: DeukPackAST, varName: string, useDict: boolean, options: any): string {
    const t = f.type;
    if (typeof t === 'string') {
      switch (t) {
        case 'bool': return `${varName} = prot.read_bool()`;
        case 'byte': case 'int8': return `${varName} = prot.read_byte()`;
        case 'int16': return `${varName} = prot.read_int16()`;
        case 'int32': return `${varName} = prot.read_int32()`;
        case 'int64': return `${varName} = prot.read_int64()`;
        case 'float': case 'double': return `${varName} = prot.read_double()`;
        case 'string': return `${varName} = prot.read_string()`;
        case 'binary': return `${varName} = prot.read_binary()`;
        default: {
            const isEnum = ast.enums.some((e: DeukPackEnum) => e.name === t);
            if (isEnum) return `${varName} = ${t}(prot.read_int32())`;
            return useDict 
                ? `${varName} = ${t}Codec.deserialize(prot)` 
                : `${varName} = ${t}(); ${varName}.deserialize(prot)`; 
        }
      }
    }
    if (t.type === 'list' || t.type === 'array') {
      const readCall = this.renderUnpackItemCall(t.elementType, ast, useDict, options);
      return `_, count = prot.read_list_begin(); ${varName} = []; [${varName}.append(${readCall}) for _i in range(count)]`;
    }
    if (t.type === 'set') {
      const readCall = this.renderUnpackItemCall(t.elementType, ast, useDict, options);
      return `_, count = prot.read_set_begin(); ${varName} = dict.fromkeys([${readCall} for _i in range(count)]).keys()`;
    }
    if (t.type === 'map') {
      const readKey = this.renderUnpackItemCall(t.keyType, ast, useDict, options);
      const readVal = this.renderUnpackItemCall(t.valueType, ast, useDict, options);
      return `_, _, count = prot.read_map_begin(); ${varName} = {}; [${varName}.update({${readKey}: ${readVal}}) for _i in range(count)]`;
    }
    return useDict 
        ? `${varName} = ${t.type}Codec.deserialize(prot)` 
        : `${varName} = ${t.type}(); ${varName}.deserialize(prot)`;
  }

  private renderUnpackItemCall(type: DeukPackType, ast: DeukPackAST, useDict: boolean, options: any): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return `prot.read_bool()`;
        case 'byte': case 'int8': return `prot.read_byte()`;
        case 'int16': return `prot.read_int16()`;
        case 'int32': return `prot.read_int32()`;
        case 'int64': return `prot.read_int64()`;
        case 'float': case 'double': return `prot.read_double()`;
        case 'string': return `prot.read_string()`;
        case 'binary': return `prot.read_binary()`;
        default: {
            const isEnum = ast.enums.some((e: DeukPackEnum) => e.name === type);
            if (isEnum) return `${type}(prot.read_int32())`;
            if (useDict) return `${type}Codec.deserialize(prot)`;
            const pyVer = parseFloat(options.pythonVersion || '3.10');
            if (pyVer >= 3.8) {
               return `(lambda p: (o := ${type}(), o.deserialize(p), o)[2])(prot)`;
            } else {
               return `(lambda p: (lambda o: (o.deserialize(p), o)[1])(${type}()))(prot)`;
            }
        }
      }
    }
    if (type.type === 'list' || type.type === 'array') {
        const readCall = this.renderUnpackItemCall(type.elementType, ast, useDict, options);
        return `(lambda p: (p.read_list_begin(), [${readCall} for _i in range(p.last_list_size)])[1])(prot)`;
    }
    if (type.type === 'set') {
        const readCall = this.renderUnpackItemCall(type.elementType, ast, useDict, options);
        return `(lambda p: (p.read_set_begin(), dict.fromkeys([${readCall} for _i in range(p.last_set_size)]).keys())[1])(prot)`;
    }
    if (type.type === 'map') {
        const readKey = this.renderUnpackItemCall(type.keyType, ast, useDict, options);
        const readVal = this.renderUnpackItemCall(type.valueType, ast, useDict, options);
        return `(lambda p: (p.read_map_begin(), {${readKey}: ${readVal} for _i in range(p.last_map_size)})[1])(prot)`;
    }
    return `Any`;
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }
}
