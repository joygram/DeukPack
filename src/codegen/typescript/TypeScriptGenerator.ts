/**
 * DeukPack TypeScript Generator
 * Emits `<namespace>_deuk.ts` (or `generated_deuk.ts`) — suffix avoids clashing with hand-written modules.
 */

import {
  DeukPackAST,
  GenerationOptions,
  DeukPackStruct,
  DeukPackEnum,
  DeukPackTypedef,
} from '../../types/DeukPackTypes';
import { CodeGenerator } from '../CodeGenerator';
import { DeukPackCodec } from '../../core/DeukPackCodec';
import { CodegenTemplateHost } from '../codegenTemplateHost';
import { buildEmbeddedStructSchema } from '../embeddedStructSchema';

export class TypeScriptGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('typescript');

  async generate(ast: DeukPackAST, _options: GenerationOptions): Promise<{ [filename: string]: string }> {
    DeukPackCodec.resolveExtends(ast);
    const out: { [filename: string]: string } = {};
    const namespaces = this.groupByNamespace(ast);

    for (const [ns, defs] of Object.entries(namespaces)) {
      const hasContent =
        (defs.enums?.length ?? 0) > 0 ||
        (defs.structs?.length ?? 0) > 0 ||
        (defs.typedefs?.length ?? 0) > 0;
      if (!hasContent) continue;

      const lines: string[] = [];
      lines.push(this._tpl.load('TsFileHeader.ts.tpl').trimEnd());
      lines.push('');

      const safeNsKey = ns.replace(/[^a-zA-Z0-9_]/g, '_');
      const packReg = `_deukEmbeddedPack_${safeNsKey}`;
      if ((defs.structs?.length ?? 0) > 0) {
        lines.push("import type { EmbeddedPackStructSchema } from 'deukpack';");
        lines.push("import { structToPackBinary, structFromPackBinary } from 'deukpack';");
        lines.push(`const ${packReg}: Record<string, EmbeddedPackStructSchema> = {};`);
        lines.push('');
      }

      // Enums
      for (const enumDef of defs.enums ?? []) {
        lines.push(...this.emitEnum(enumDef));
        lines.push('');
      }

      // Typedefs (type aliases)
      for (const typedef of defs.typedefs ?? []) {
        lines.push(...this.emitTypedef(typedef, ast, ns));
        lines.push('');
      }

      // Structs: interface + FieldId + pack (deuk native) helpers
      for (const struct of defs.structs ?? []) {
        lines.push(...this.emitStruct(struct, ast, ns, (defs.structs?.length ?? 0) > 0 ? packReg : undefined));
        lines.push('');
      }

      const safeNs = safeNsKey;
      const filename = safeNs === 'Generated' ? 'generated_deuk.ts' : `${safeNs}_deuk.ts`;
      out[filename] = lines.join('\n');
    }

    if (Object.keys(out).length === 0) {
      out['generated_deuk.ts'] = this._tpl.load('TsEmptyModule.ts.tpl').trimEnd() + '\n';
    }
    return out;
  }

  private getStructNamespace(struct: DeukPackStruct, ast: DeukPackAST): string {
    if (struct.sourceFile && ast.fileNamespaceMap) {
      const ns = ast.fileNamespaceMap[struct.sourceFile];
      if (ns) return ns;
    }
    if (struct.sourceFile) {
      const ns = ast.namespaces?.find(
        (n) => (n.language === '*' || n.language === 'csharp' || n.language === 'typescript' || n.language === 'ts') &&
          n.sourceFile === struct.sourceFile
      );
      if (ns?.name) return ns.name;
    }
    const fallback = ast.namespaces?.find(
      (n) => n.language === '*' || n.language === 'csharp' || n.language === 'typescript' || n.language === 'ts'
    );
    return fallback?.name ?? 'Generated';
  }

  private getEnumNamespace(enumDef: DeukPackEnum, ast: DeukPackAST): string {
    if (enumDef.sourceFile && ast.fileNamespaceMap) {
      const ns = ast.fileNamespaceMap[enumDef.sourceFile];
      if (ns) return ns;
    }
    if (enumDef.sourceFile) {
      const ns = ast.namespaces?.find(
        (n) => (n.language === '*' || n.language === 'csharp' || n.language === 'typescript' || n.language === 'ts') &&
          n.sourceFile === enumDef.sourceFile
      );
      if (ns?.name) return ns.name;
    }
    const fallback = ast.namespaces?.find(
      (n) => n.language === '*' || n.language === 'csharp' || n.language === 'typescript' || n.language === 'ts'
    );
    return fallback?.name ?? 'Generated';
  }

  private getTypedefNamespace(typedef: DeukPackTypedef, ast: DeukPackAST): string {
    if (typedef.sourceFile && ast.fileNamespaceMap) {
      const ns = ast.fileNamespaceMap[typedef.sourceFile];
      if (ns) return ns;
    }
    const fallback = ast.namespaces?.find(
      (n) => n.language === '*' || n.language === 'csharp' || n.language === 'typescript' || n.language === 'ts'
    );
    return fallback?.name ?? 'Generated';
  }

  private groupByNamespace(ast: DeukPackAST): Record<string, { enums: DeukPackEnum[]; structs: DeukPackStruct[]; typedefs: DeukPackTypedef[] }> {
    const nameSet = new Set<string>();
    if (ast.namespaces?.length) {
      for (const n of ast.namespaces) if (n.name) nameSet.add(n.name);
    }
    for (const e of ast.enums ?? []) nameSet.add(this.getEnumNamespace(e, ast));
    for (const s of ast.structs ?? []) nameSet.add(this.getStructNamespace(s, ast));
    for (const t of ast.typedefs ?? []) nameSet.add(this.getTypedefNamespace(t, ast));
    if (nameSet.size === 0) nameSet.add('Generated');

    const groups: Record<string, { enums: DeukPackEnum[]; structs: DeukPackStruct[]; typedefs: DeukPackTypedef[] }> = {};
    for (const n of nameSet) {
      groups[n] = { enums: [], structs: [], typedefs: [] };
    }
    for (const e of ast.enums ?? []) {
      const ns = this.getEnumNamespace(e, ast);
      if (groups[ns]) groups[ns].enums.push(e);
    }
    for (const s of ast.structs ?? []) {
      const ns = this.getStructNamespace(s, ast);
      if (groups[ns]) groups[ns].structs.push(s);
    }
    for (const t of ast.typedefs ?? []) {
      const ns = this.getTypedefNamespace(t, ast);
      if (groups[ns]) groups[ns].typedefs.push(t);
    }
    return groups;
  }

  private getTsType(type: any, ast: DeukPackAST, currentNs: string): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'boolean';
        case 'byte': case 'int8': case 'int16': case 'int32': return 'number';
        case 'int64': case 'float': case 'double': return 'number';
        case 'string': return 'string';
        case 'binary': return 'Uint8Array | number[]';
        case 'datetime': case 'timestamp': case 'date': case 'time': return 'number';
        case 'decimal': case 'numeric': return 'number';
        default: {
          const full = this.resolveTypeToFullName(type, currentNs, ast);
          const prim = ['bool','byte','int8','int16','int32','int64','float','double','string','binary','datetime','timestamp','date','time','decimal','numeric'];
          if (prim.includes(full)) return this.getTsType(full as any, ast, currentNs);
          const typedef = ast.typedefs?.find((t) => this.getTypedefFullName(t, ast) === full);
          if (typedef) return this.getTsType(typedef.type, ast, currentNs);
          const short = full.includes('.') ? full.split('.').pop()! : full;
          return full.startsWith(currentNs + '.') ? short : full;
        }
      }
    }
    if (typeof type === 'object' && type?.type) {
      switch (type.type) {
        case 'list':
        case 'array':
        case 'set':
          return `${this.getTsType(type.elementType, ast, currentNs)}[]`;
        case 'map':
          return `Record<${this.getTsType(type.keyType, ast, currentNs)}, ${this.getTsType(type.valueType, ast, currentNs)}>`;
        case 'tablelink':
          return 'number';
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  }

  private getStructFullName(struct: DeukPackStruct, ast: DeukPackAST): string {
    const ns = this.getStructNamespace(struct, ast);
    const short = struct.name.includes('.') ? struct.name.split('.').pop()! : struct.name;
    return `${ns}.${short}`;
  }

  private getEnumFullName(enumDef: DeukPackEnum, ast: DeukPackAST): string {
    const ns = this.getEnumNamespace(enumDef, ast);
    const short = enumDef.name.includes('.') ? enumDef.name.split('.').pop()! : enumDef.name;
    return `${ns}.${short}`;
  }

  private getTypedefFullName(typedef: DeukPackTypedef, ast: DeukPackAST): string {
    const ns = this.getTypedefNamespace(typedef, ast);
    const short = typedef.name.includes('.') ? typedef.name.split('.').pop()! : typedef.name;
    return `${ns}.${short}`;
  }

  private resolveTypeToFullName(typeStr: string, currentNs: string | undefined, ast: DeukPackAST): string {
    if (!typeStr || typeof typeStr !== 'string') return typeStr;
    const prim = ['bool','byte','int8','int16','int32','int64','float','double','string','binary','datetime','timestamp','date','time','decimal','numeric'];
    if (prim.includes(typeStr)) return typeStr;
    if (!ast) return typeStr;
    if (typeStr.includes('.')) {
      for (const s of ast.structs ?? []) if (this.getStructFullName(s, ast) === typeStr) return typeStr;
      for (const e of ast.enums ?? []) if (this.getEnumFullName(e, ast) === typeStr) return typeStr;
      for (const t of ast.typedefs ?? []) if (this.getTypedefFullName(t, ast) === typeStr) return typeStr;
      return typeStr;
    }
    const same = currentNs ? `${currentNs}.${typeStr}` : '';
    if (same) {
      for (const s of ast.structs ?? []) if (this.getStructFullName(s, ast) === same) return same;
      for (const e of ast.enums ?? []) if (this.getEnumFullName(e, ast) === same) return same;
      for (const t of ast.typedefs ?? []) if (this.getTypedefFullName(t, ast) === same) return same;
    }
    const matches: string[] = [];
    for (const s of ast.structs ?? []) {
      const full = this.getStructFullName(s, ast);
      if (full.endsWith('.' + typeStr)) matches.push(full);
    }
    for (const e of ast.enums ?? []) {
      const full = this.getEnumFullName(e, ast);
      if (full.endsWith('.' + typeStr)) matches.push(full);
    }
    for (const t of ast.typedefs ?? []) {
      const full = this.getTypedefFullName(t, ast);
      if (full.endsWith('.' + typeStr)) matches.push(full);
    }
    if (matches.length === 0) return typeStr;
    if (currentNs && matches.some((m) => m.startsWith(currentNs + '.'))) {
      return matches.find((m) => m.startsWith(currentNs + '.')) ?? matches[0] ?? typeStr;
    }
    return matches[0] ?? typeStr;
  }

  private capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private emitEnum(enumDef: DeukPackEnum): string[] {
    const name = enumDef.name.includes('.') ? enumDef.name.split('.').pop()! : enumDef.name;
    const entryLines: string[] = [];
    for (const [k, v] of Object.entries(enumDef.values ?? {})) {
      entryLines.push(`  ${k}: ${v},`);
    }
    const block = this._tpl.render('TsEnumBlock.ts.tpl', {
      ENUM_SHORT_NAME: name,
      ENUM_ENTRIES: entryLines.join('\n'),
    });
    return block.split('\n');
  }

  private emitTypedef(typedef: DeukPackTypedef, ast: DeukPackAST, ns: string): string[] {
    const name = typedef.name.includes('.') ? typedef.name.split('.').pop()! : typedef.name;
    const tsType = this.getTsType(typedef.type, ast, ns);
    const block = this._tpl.render('TsTypedefBlock.ts.tpl', {
      TYPEDEF_NAME: name,
      TS_TYPE: tsType,
    });
    return block.split('\n');
  }

  private packCodecFnBase(shortName: string): string {
    return shortName.charAt(0).toLowerCase() + shortName.slice(1);
  }

  private emitStruct(struct: DeukPackStruct, ast: DeukPackAST, ns: string, packReg?: string): string[] {
    const shortName = struct.name.includes('.') ? struct.name.split('.').pop()! : struct.name;

    const ifaceLines: string[] = [];
    for (const f of struct.fields ?? []) {
      const tsType = this.getTsType(f.type, ast, ns);
      const opt = f.required ? '' : '?';
      ifaceLines.push(`  ${f.name}${opt}: ${tsType};`);
    }
    const fieldIdLines: string[] = [];
    for (const f of struct.fields ?? []) {
      const prop = this.capitalize(f.name);
      fieldIdLines.push(`  ${prop}: ${f.id},`);
    }
    const block = this._tpl.render('TsStructBlock.ts.tpl', {
      STRUCT_SHORT_NAME: shortName,
      INTERFACE_FIELDS: ifaceLines.join('\n'),
      FIELD_ID_ENTRIES: fieldIdLines.join('\n'),
    });
    const out = block.split('\n');
    if (packReg) {
      const packJson = JSON.stringify(buildEmbeddedStructSchema(struct, ast));
      const codecBlock = this._tpl.render('TsPackCodec.ts.tpl', {
        STRUCT_SHORT_NAME: shortName,
        PACK_JSON_STR: JSON.stringify(packJson),
        PACK_REG: packReg,
        CODEC_FN_BASE: this.packCodecFnBase(shortName),
      });
      out.push(...codecBlock.split('\n'));
    }
    return out;
  }
}
