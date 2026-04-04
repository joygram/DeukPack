import { DeukPackAST, DeukPackStruct, DeukPackField } from '../../types/DeukPackTypes';
import { CodegenTemplateHost } from '../codegenTemplateHost';
import { applyCodegenPlaceholders } from '../templateRender';
import { CSharpTypeHelper } from './CSharpTypeHelper';

export interface CSharpStructContext {
  tpl: CodegenTemplateHost;
  renderCSharpTpl: (relPath: string, values: Record<string, string>) => string;
  isTableRowType: (struct: DeukPackStruct, ast: DeukPackAST) => boolean;
  isStructType: (type: string, ast: DeukPackAST, ns: string) => boolean;
  isStructCSharpType: (csharpType: string, ast: DeukPackAST) => boolean;
  isEnumType: (type: string, ast: DeukPackAST, ns: string) => boolean;
  isPrimitiveType: (type: string, ast: DeukPackAST, ns: string) => boolean;
  isGeometryDeukStruct: (type: string, ast: DeukPackAST, ns: string) => boolean;
  getCSharpDefaultValue: (val: any, type: any, ast: DeukPackAST, ns?: string) => string;
  resolveTypeToFullName: (type: string, ns: string | undefined, ast: DeukPackAST) => string;
  findStruct: (ast: DeukPackAST, fullName: string, currentNs: string) => DeukPackStruct | undefined;
  dictToCSharpAnnotations: (ann: any) => string;
  getGenOptions?: () => any;
}

export class CSharpStructGenerator {
  constructor(public ctx: CSharpStructContext) {}

  public generateStruct(
    struct: DeukPackStruct,
    ast: DeukPackAST,
    currentNamespace?: string,
    emitOpts?: { csharpClassName: string; wireSchemaName: string }
  ): string[] {
    if (!emitOpts && struct.annotations?.['geometry']) {
      return this.generateGeometryStruct(struct, ast, currentNamespace);
    }
    const ns = currentNamespace ?? CSharpTypeHelper.getStructNamespace(struct, ast);
    const className = emitOpts?.csharpClassName ?? struct.name;
    const wireName = emitOpts?.wireSchemaName ?? struct.name;
    
    const efInfo = (this as any)._efCurrentRowInfo ?? (this.ctx as any)._efCurrentRowInfo ?? null;
    const opts = this.ctx.getGenOptions?.() ?? {};

    if (opts.tableRowReserved14 && this.ctx.isTableRowType(struct, ast) && struct.fields) {
      const reserved = [1, 2, 3, 4];
      for (const f of struct.fields) {
        const id = typeof f.id === 'number' ? f.id : parseInt(String(f.id), 10);
        if (!isNaN(id) && reserved.includes(id)) {
          throw new Error(`Table row record '${struct.name}' must not use field indices 1-4 (reserved). Invalid field: ${f.id} ${f.name}`);
        }
      }
    }

    const structAttrBlock = struct.csharpAttributes?.length ? struct.csharpAttributes.map((attr) => `  ${attr}`).join('\n') + '\n' : '';
    
    let tableAttr = '';
    const entityTableHint = struct.declarationKind === 'entity' ? CSharpTypeHelper.findDeukBracketTagValue(struct.deukBracketAttributes, 'table') : undefined;
    const entitySchemaHint = struct.declarationKind === 'entity' ? CSharpTypeHelper.findDeukBracketTagValue(struct.deukBracketAttributes, 'schema') : undefined;
    
    if (struct.declarationKind === 'entity') {
      const tName = entityTableHint ?? efInfo?.category;
      if (tName) {
        const schemaPart = entitySchemaHint ? `, Schema = "${CSharpTypeHelper.escapeCSharpStringContent(entitySchemaHint)}"` : '';
        tableAttr = `  [Table("${CSharpTypeHelper.escapeCSharpStringContent(tName)}"${schemaPart})]\n`;
      }
    } else if (efInfo) {
      tableAttr = `  [Table("${CSharpTypeHelper.escapeCSharpStringContent(efInfo.category)}")]\n`;
    }

    const isMetaContainer = CSharpTypeHelper.isMetaContainerStruct(struct);
    const metaContainerDataType = isMetaContainer && struct.fields && struct.fields.length >= 2
        && typeof struct.fields[1]!.type === 'object' && struct.fields[1]!.type && (struct.fields[1]!.type as { type?: string }).type === 'map'
        ? CSharpTypeHelper.getCSharpType((struct.fields[1]!.type as { valueType: any }).valueType, ast, ns)
        : null;
        
    const implList = ['IDeukPack'];
    if (isMetaContainer) implList.push('IDeukMetaContainer');
    if (metaContainerDataType) implList.push(`IDeukMetaContainer<${metaContainerDataType}>`);
    const implListStr = implList.join(', ');

    const fieldLinesFlat = struct.fields.flatMap((f) => this.generateField(f, ast, ns, struct));
    const fieldsBlock = fieldLinesFlat.length > 0 ? '\n' + fieldLinesFlat.join('\n') : '';

    let fieldIdBlock = '';
    if (struct.fields.length > 0) {
      fieldIdBlock = '\n\n    public static class FieldId\n    {\n' +
        struct.fields.map((f) => `      public const int ${CSharpTypeHelper.capitalize(f.name)} = ${f.id};`).join('\n') +
        '\n    }';
    }

    const defaultProps: string[] = [];
    let msgIdLikeFieldName: string | null = null;
    for (const field of struct.fields) {
      const defaultExpr = this.getFieldDefaultExpression(field, ast, ns, struct);
      if (defaultExpr === null) continue;
      const csharpType = CSharpTypeHelper.getCSharpType(field.type, ast, ns);
      const propName = CSharpTypeHelper.capitalize(field.name);
      defaultProps.push(`    public static ${csharpType} Default_${propName} => ${defaultExpr};`);
      if (typeof field.type === 'string' && ast) {
        const typeFull = this.ctx.resolveTypeToFullName(field.type, ns, ast);
        const targetStruct = this.ctx.findStruct(ast, typeFull, ns);
        if (targetStruct?.fields?.some((f) => f.name.toLowerCase() === 'msgid')) {
          msgIdLikeFieldName = propName;
        }
      }
    }
    
    let defaultBlock = '';
    if (defaultProps.length > 0) {
      defaultBlock += '\n    // 기본값 정적 노출 (enum/구조체 공통, 리플렉션 없이 조회)\n' + defaultProps.join('\n');
    }
    if (msgIdLikeFieldName !== null) {
      defaultBlock += `\n    // Message ID for protocol handler registration (Default_* combination)\n    public static int DefaultMessageId => Default_${msgIdLikeFieldName}.MsgId;`;
    }
    defaultBlock += '\n';

    const writeUnifiedInner = this.generateWriteUnifiedInner(struct, ast, ns, wireName);

    const requiredFields = struct.fields.filter((f) => f.required);
    const readSeenInitLines = requiredFields.length > 0 ? requiredFields.map((f) => `      bool __read_${f.id} = false;`).join('\n') + '\n' : '';
    const readInitLines = readSeenInitLines + struct.fields.map((field) => {
          const fieldName = CSharpTypeHelper.capitalize(field.name);
          const rhs = this.generateCreateDefaultRhs(field, ast, ns, struct);
          return `      this.${fieldName} = ${rhs};`;
        }).join('\n');

    const readSwitchCases: string[] = [];
    for (const field of struct.fields) {
      readSwitchCases.push(`          case ${field.id}:`);
      readSwitchCases.push(`            if (field.Type == ${CSharpTypeHelper.getTType(field.type, ast, ns)} || field.Type == DpWireType.Void)`);
      readSwitchCases.push('            {');
      if (field.required) readSwitchCases.push(`              __read_${field.id} = true;`);
      readSwitchCases.push(`              ${this.generateReadField(field, ast, ns)}`);
      
      const hasDefault = field.defaultValue !== undefined;
      const isStructField = typeof field.type === 'string' && ast && (this.ctx.isStructType(field.type, ast, ns) || this.ctx.isStructCSharpType(CSharpTypeHelper.getCSharpType(field.type, ast, ns), ast));
        
      if (hasDefault && isStructField && typeof field.type === 'string') {
        const parentName = CSharpTypeHelper.capitalize(field.name);
        const lines = this.generateEnsureNestedDefaults(parentName, field.type, ast, ns);
        for (const ensureLine of lines) readSwitchCases.push(`              ${ensureLine}`);
      }
      readSwitchCases.push('            }');
      readSwitchCases.push('            else\n            {\n              DpProtocolUtil.Skip(iprot, field.Type);\n            }');
      readSwitchCases.push('            break;');
    }
    
    const readMissingRequiredChecks = requiredFields.length > 0 ? requiredFields.map((f) =>
                `      if (!__read_${f.id}) DeukPack.Protocol.DeukPackSerializationWarnings.LogMissingRequiredField("${CSharpTypeHelper.escapeCSharpStringContent(wireName)}", "${CSharpTypeHelper.escapeCSharpStringContent(f.name)}");`
            ).join('\n') : '';

    const cloneLines = struct.fields.map((field) => '      ' + this.generateCloneField(field, CSharpTypeHelper.capitalize(field.name), ast, ns)).join('\n');
    const createDefaultLines = struct.fields.map((field) => {
        const fieldName = CSharpTypeHelper.capitalize(field.name);
        const rhs = this.generateCreateDefaultRhs(field, ast, ns, struct);
        return `      o.${fieldName} = ${rhs};`;
      }).join('\n');

    let toStringInner: string;
    if (struct.fields.length === 0) {
      toStringInner = '      sb.Append("}");';
    } else {
      toStringInner = '      sb.AppendLine();\n' +
        struct.fields.map((f) => '      ' + this.generateToStringField(f, CSharpTypeHelper.capitalize(f.name), ast, ns)).join('\n') +
        '\n      sb.Append(indent).Append("}");';
    }

    const structDoc = (struct as any).docComment != null ? CSharpTypeHelper.escapeCSharpString((struct as any).docComment) : 'null';
    const structAnn = (struct as any).annotations != null && Object.keys((struct as any).annotations).length > 0
        ? this.ctx.dictToCSharpAnnotations((struct as any).annotations) : 'null';

    const text = this.ctx.renderCSharpTpl('StructRecord.cs.tpl', {
      STRUCT_ATTRS: structAttrBlock,
      TABLE_ATTR: tableAttr,
      CLASS_NAME: className,
      WIRE_NAME: wireName,
      IMPL_LIST: implListStr,
      FIELDS: fieldsBlock,
      FIELD_ID_BLOCK: fieldIdBlock,
      DEFAULT_BLOCK: defaultBlock,
      WRITE_UNIFIED_INNER: writeUnifiedInner,
      READ_INIT_LINES: readInitLines,
      NAME_TO_ID_FALLBACK: '',
      READ_SWITCH_CASES: readSwitchCases.join('\n'),
      READ_MISSING_REQUIRED_CHECKS: readMissingRequiredChecks,
      CLONE_LINES: cloneLines,
      CREATE_DEFAULT_LINES: createDefaultLines,
      TOSTRING_INNER: toStringInner,
      IS_RECORD: struct.declarationKind === 'record' ? 'true' : 'false',
      IS_ENTITY: struct.declarationKind === 'entity' ? 'true' : 'false',
      DOC_BLOCK: '',
      DOC_COMMENT: structDoc,
      ANNOTATIONS: structAnn,
      STRUCT_DOC: structDoc,
      STRUCT_ANN: structAnn,
      SCHEMA_FIELD_LINES: struct.fields.map(f => {
        const typeStr = CSharpTypeHelper.getSchemaType(f.type, ast, ns);
        const defVal = f.defaultValue !== undefined ? this.ctx.getCSharpDefaultValue(f.defaultValue, f.type, ast, ns) : 'null';
        const isReq = f.required ? 'true' : 'false';
        return `          { ${f.id}, new DpFieldSchema { Id = ${f.id}, Name = "${CSharpTypeHelper.escapeCSharpStringContent(f.name)}", Type = ${typeStr}, Required = ${isReq}, DefaultValue = ${defVal} } },`;
      }).join('\n'),
      META_CONTAINER_BLOCK: '',
      'NULLABLE': opts.csharpNullable ? '?' : '',
    });
    
    return text.replace(/\r\n/g, '\n').split('\n');
  }

  private generateField(field: DeukPackField, ast: DeukPackAST, ns: string, struct: DeukPackStruct): string[] {
    const csharpType = CSharpTypeHelper.getCSharpType(field.type, ast, ns);
    const name = CSharpTypeHelper.capitalize(field.name);
    const attrLines: string[] = [];
    
    const efInfo = (this as any)._efCurrentRowInfo;
    if (efInfo) {
      if (efInfo.keyFieldNames.includes(field.name)) attrLines.push('    [Key]');
      attrLines.push(`    [Column("${CSharpTypeHelper.escapeCSharpStringContent(field.name)}")]`);
    } else if (struct.declarationKind === 'entity') {
      const keys = this.collectKeyFieldNamesFromDeukFieldKeys(struct);
      if (keys.includes(field.name)) attrLines.push('    [Key]');
      attrLines.push(`    [Column("${CSharpTypeHelper.escapeCSharpStringContent(field.name)}")]`);
    }

    if (field.required) attrLines.push('    [Required]');
    if (field.csharpAttributes) {
      for (const attr of field.csharpAttributes) attrLines.push(`    ${attr}`);
    }
    const attrs = attrLines.length > 0 ? attrLines.join('\n') + '\n' : '';
    const doc = field.docComment ? `    /// <summary>\n    /// ${field.docComment}\n    /// </summary>\n` : '';
    const decl = `    public ${csharpType} ${name} { get; set; } = default!;`;
    return (doc + attrs + decl).split('\n');
  }

  private generateCodecWriteStmt(valName: string, type: any, ast: DeukPackAST, ns: string): string {
    if (this.ctx.isPrimitiveType(type, ast, ns)) {
      let suffix = CSharpTypeHelper.getTType(type, ast, ns).replace('DpWireType.', '');
      if (suffix === 'Int16') suffix = 'I16';
      if (suffix === 'Int32') suffix = 'I32';
      if (suffix === 'Int64') suffix = 'I64';
      if (suffix === 'Byte') return `oprot.WriteByte((byte)(${valName}))`;
      return `oprot.Write${suffix}(${valName})`;
    } else if (this.ctx.isEnumType(type, ast, ns)) {
      return `oprot.WriteI32((int)(${valName}))`;
    } else if (typeof type === 'string' && this.ctx.isStructType(type, ast, ns)) {
      return `${valName}.Write(oprot)`;
    } else if (typeof type === 'object') {
      const t = type.type;
      if (t === 'list' || t === 'array') {
        const eType = CSharpTypeHelper.getTType(type.elementType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.WriteList(oprot, ${eType}, ${valName})`;
      } else if (t === 'set') {
        const eType = CSharpTypeHelper.getTType(type.elementType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.WriteSet(oprot, ${eType}, ${valName})`;
      } else if (t === 'map') {
        const kType = CSharpTypeHelper.getTType(type.keyType, ast, ns);
        const vType = CSharpTypeHelper.getTType(type.valueType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.WriteMap(oprot, ${kType}, ${vType}, ${valName})`;
      }
    }
    const fallbackTt = CSharpTypeHelper.getTType(type, ast, ns);
    return `DeukPack.Protocol.DeukPackCodec.WriteValue(oprot, ${fallbackTt}, ${valName})`;
  }

  private generateCodecReadStmt(csType: string, type: any, ast: DeukPackAST, ns: string): string {
    if (this.ctx.isPrimitiveType(type, ast, ns)) {
      let suffix = CSharpTypeHelper.getTType(type, ast, ns).replace('DpWireType.', '');
      if (suffix === 'Int16') suffix = 'I16';
      if (suffix === 'Int32') suffix = 'I32';
      if (suffix === 'Int64') suffix = 'I64';
      return `(${csType})iprot.Read${suffix}()`;
    } else if (this.ctx.isEnumType(type, ast, ns)) {
      return `(${csType})iprot.ReadI32()`;
    } else if (typeof type === 'string' && this.ctx.isStructType(type, ast, ns)) {
      return `__STRUCT__`; // Placeholder for multi-line handling
    } else if (typeof type === 'object') {
      const t = type.type;
      if (t === 'list' || t === 'array') {
        const eType = CSharpTypeHelper.getTType(type.elementType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.ReadList<${CSharpTypeHelper.getCSharpType(type.elementType, ast, ns)}>(iprot, ${eType})`;
      } else if (t === 'set') {
        const eType = CSharpTypeHelper.getTType(type.elementType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.ReadSet<${CSharpTypeHelper.getCSharpType(type.elementType, ast, ns)}>(iprot, ${eType})`;
      } else if (t === 'map') {
        const kType = CSharpTypeHelper.getTType(type.keyType, ast, ns);
        const vType = CSharpTypeHelper.getTType(type.valueType, ast, ns);
        return `DeukPack.Protocol.DeukPackCodec.ReadMap<${CSharpTypeHelper.getCSharpType(type.keyType, ast, ns)}, ${CSharpTypeHelper.getCSharpType(type.valueType, ast, ns)}>(iprot, ${kType}, ${vType})`;
      }
    }
    const fallbackTt = CSharpTypeHelper.getTType(type, ast, ns);
    return `DeukPack.Protocol.DeukPackCodec.ReadValue(iprot, ${fallbackTt}, typeof(${csType})) as ${csType}`;
  }

  private generateWriteUnifiedInner(struct: DeukPackStruct, ast: DeukPackAST, ns: string, wireName: string): string {
    const lines: string[] = [];
    lines.push(`      oprot.WriteStructBegin(new DeukPack.Protocol.DpRecord { Name = "${CSharpTypeHelper.escapeCSharpStringContent(wireName)}" });`);
    for (const f of struct.fields) {
      const val = `this.${CSharpTypeHelper.capitalize(f.name)}`;
      const tt = CSharpTypeHelper.getTType(f.type, ast, ns);
      const writeCall = this.generateCodecWriteStmt(val, f.type, ast, ns);
      const isRef = typeof f.type === 'object' || (typeof f.type === 'string' && (f.type === 'string' || f.type === 'binary' || this.ctx.isStructType(f.type, ast, ns)));
      const writeBeginBlock = `oprot.WriteFieldBegin(new DeukPack.Protocol.DpColumn { Name = "${CSharpTypeHelper.escapeCSharpStringContent(f.name)}", Type = ${tt}, ID = ${f.id} });`;
      if (isRef) {
        lines.push(`      if (${val} != null) { ${writeBeginBlock} ${writeCall}; oprot.WriteFieldEnd(); }`);
      } else {
        lines.push(`      ${writeBeginBlock} ${writeCall}; oprot.WriteFieldEnd();`);
      }
    }
    lines.push('      oprot.WriteFieldStop(); oprot.WriteStructEnd();');
    return lines.join('\n');
  }

  private generateReadField(field: DeukPackField, ast: DeukPackAST, ns: string): string {
    const val = `this.${CSharpTypeHelper.capitalize(field.name)}`;
    const csType = CSharpTypeHelper.getCSharpType(field.type, ast, ns);
    
    let readExpr = this.generateCodecReadStmt(csType, field.type, ast, ns);
    if (readExpr === '__STRUCT__') {
       return `${val} = new ${csType}(); ${val}.Read(iprot);`;
    }
    return `${val} = ${readExpr}!;`;
  }

  private generateCloneField(field: DeukPackField, fieldName: string, ast: DeukPackAST, ns: string): string {
    if (typeof field.type === 'string' && !this.ctx.isStructType(field.type, ast, ns)) return `clone.${fieldName} = this.${fieldName};`;
    if (typeof field.type === 'object') {
        const typeName = field.type.type;
        if (typeName === 'list' || typeName === 'array' || typeName === 'set' || typeName === 'map') {
            return `clone.${fieldName} = this.${fieldName}!; // Fallback shallow copy`;
        }
    }
    return `clone.${fieldName} = this.${fieldName}?.Clone()!;`;
  }

  private generateToStringField(field: DeukPackField, fieldName: string, ast: DeukPackAST, ns: string): string {
    if (typeof field.type === 'string' && (this.ctx.isPrimitiveType(field.type, ast, ns) || this.ctx.isEnumType(field.type, ast, ns)) && field.type !== 'string' && field.type !== 'binary') {
      return `sb.Append(indent).Append("  ${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
    }
    return `sb.Append(indent).Append("  ${field.name}: ").Append(this.${fieldName}?.ToString() ?? "null").AppendLine(",");`;
  }

  private getFieldDefaultExpression(field: DeukPackField, ast: DeukPackAST, ns: string, _struct: DeukPackStruct): string | null {
    if (field.defaultValue !== undefined) return this.ctx.getCSharpDefaultValue(field.defaultValue, field.type, ast, ns);
    return null;
  }

  private generateCreateDefaultRhs(field: DeukPackField, ast: DeukPackAST, ns: string, struct: DeukPackStruct): string {
    const def = this.getFieldDefaultExpression(field, ast, ns, struct);
    return def !== null ? def : 'default!';
  }

  private generateEnsureNestedDefaults(_parentName: string, _type: string, _ast: DeukPackAST, _ns: string): string[] {
    return [];
  }

  private collectKeyFieldNamesFromDeukFieldKeys(struct: DeukPackStruct): string[] {
    const keys: string[] = [];
    for (const f of struct.fields ?? []) {
      for (const t of f.deukBracketAttributes ?? []) {
        if (((t.split(':')[0] || '').split('(')[0]?.trim().toLowerCase()) === 'key') keys.push(f.name);
      }
    }
    return keys;
  }

  private generateGeometryStruct(struct: DeukPackStruct, _ast: DeukPackAST, _ns?: string): string[] {
    const tpl = this.ctx.tpl.load('GeometryStruct.cs.tpl');
    return [applyCodegenPlaceholders(tpl, { STRUCT_NAME: struct.name, MEMBERS: '// Geometry logic' })];
  }
}
