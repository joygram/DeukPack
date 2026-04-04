import { DeukPackAST, GenerationOptions, DeukPackStruct, DeukPackEnum, DeukPackTypedef, DeukPackService } from '../types/DeukPackTypes';
import { CodeGenerator } from './CodeGenerator';
import { DeukPackCodec } from '../core/DeukPackCodec';
import { CodegenTemplateHost } from './codegenTemplateHost';
import { CSharpTypeHelper } from './csharp/CSharpTypeHelper';
import { CSharpEfCoreGenerator, CSharpEfContext } from './csharp/CSharpEfCoreGenerator';
import { CSharpStructGenerator, CSharpStructContext } from './csharp/CSharpStructGenerator';
import { applyCodegenPlaceholders } from './templateRender';

interface NamespaceDefs {
  enums: DeukPackEnum[];
  structs: DeukPackStruct[];
  typedefs: DeukPackTypedef[];
  constants: any[];
  services: DeukPackService[];
}

export class CSharpGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('csharp');
  private readonly _efGen: CSharpEfCoreGenerator;
  private readonly _structGen: CSharpStructGenerator;

  constructor() {
    super();
    const self = this as any;
    
    const efCtx: CSharpEfContext = {
      tpl: this._tpl,
      isMetaContainerStruct: (s) => CSharpTypeHelper.isMetaContainerStruct(s),
      renderCSharpTpl: (p, v) => self.renderCSharpTpl(p, v),
    };
    this._efGen = new CSharpEfCoreGenerator(efCtx);

    const structCtx: CSharpStructContext = {
        tpl: this._tpl,
        renderCSharpTpl: (p, v) => self.renderCSharpTpl(p, v),
        isTableRowType: (s, ast) => self.isTableRowType(s, ast),
        isStructType: (t, ast, ns) => self.isStructType(t, ast, ns),
        isStructCSharpType: (c, ast) => self.isStructCSharpType(c, ast),
        isEnumType: (t, ast, ns) => self.isEnumType(t, ast, ns),
        isPrimitiveType: (t, ast, ns) => self.isPrimitiveType(t, ast, ns),
        isGeometryDeukStruct: (t, ast, ns) => self.isGeometryDeukStruct(t, ast, ns),
        getCSharpDefaultValue: (v, t, ast, ns) => self.getCSharpDefaultValue(v, t, ast, ns),
        resolveTypeToFullName: (t, ns, ast) => self.resolveTypeToFullName(t, ns, ast),
        findStruct: (ast, f, ns) => self.findStruct(ast, f, ns),
        dictToCSharpAnnotations: (ann) => self.dictToCSharpAnnotations(ann),
        getGenOptions: () => (self as any)._genOptions || {},
    };
    this._structGen = new CSharpStructGenerator(structCtx);
  }

  async generate(ast: DeukPackAST, options: GenerationOptions): Promise<{ [filename: string]: string }> {
    (this as any)._csharpNullable = options.csharpNullable === true;
    (this as any)._genOptions = options;

    DeukPackCodec.resolveExtends(ast);
    const files: { [filename: string]: string } = {};
    const fileGroups = this.groupBySourceFile(ast);
    const metaTableDefs = this._efGen.collectMetaTableDefinitions(ast);
    const entityDefs = this._efGen.collectEntityDefinitions(ast);
    this._efGen.validateTableLinkFields(ast, metaTableDefs);

    const rowDbMap = new Map<string, { category: string; keyFieldNames: string[] }>();
    for (const d of entityDefs) rowDbMap.set(d.rowTypeFull, { category: d.category, keyFieldNames: d.keyFieldNames });
    if (options.efSupport) {
      for (const d of metaTableDefs) {
        if (!rowDbMap.has(d.rowTypeFull)) rowDbMap.set(d.rowTypeFull, { category: d.category, keyFieldNames: d.keyFieldNames });
      }
    }
    (this as any)._efMetaRowInfo = rowDbMap;

    for (const [sourceFile, defs] of Object.entries(fileGroups)) {
      const lines: string[] = [];
      const docBlock = this._tpl.load('StandardDeukPackFileDoc.cs.tpl').trimEnd();
      const needsEf = (defs as any).structs.some((s: any) => rowDbMap.has(CSharpTypeHelper.getStructFullName(s, ast)));
      const efUsings = needsEf ? 'using System.ComponentModel.DataAnnotations;\nusing System.ComponentModel.DataAnnotations.Schema;\n' : '';
      
      lines.push(...this.renderCSharpTpl('CSharpMainFileHeader.cs.tpl', {
        DOC_BLOCK: docBlock,
        EF_USINGS: efUsings,
        NULLABLE_ENABLE: options.csharpNullable ? '#nullable enable' : '',
      }).split('\n'));

      const groups = this.groupByNamespace({
        namespaces: ast.namespaces,
        structs: (defs as any).structs,
        enums: (defs as any).enums,
        services: (defs as any).services,
        typedefs: (defs as any).typedefs,
        constants: (defs as any).constants,
        includes: [],
        annotations: {}
      }) as Record<string, NamespaceDefs>;

      for (const [ns, nsDefs] of Object.entries(groups)) {
        if (!nsDefs.enums.length && !nsDefs.structs.length && !nsDefs.typedefs.length && !nsDefs.constants.length) continue;
        lines.push(`namespace ${ns}\n{`);
        for (const td of nsDefs.typedefs) lines.push(...this.generateTypedef(td));
        for (const enm of nsDefs.enums) lines.push(...this.generateEnum(enm));
        for (const cnst of nsDefs.constants) lines.push(...this.generateConstant(cnst, ast));
        for (const str of nsDefs.structs) lines.push(...this.generateStruct(str, ast, ns));
        lines.push('}');
      }
      const baseName = sourceFile.replace(/\\/g, '/').split('/').pop() || 'Generated.deuk';
      files[baseName.replace(/\.deuk$/, '.g.cs')] = lines.join('\n');
    }

    if (options.efSupport) {
      files['DeukPackDbContext.g.cs'] = this._efGen.generateEfDbContext(metaTableDefs, entityDefs);
      files['MetaTableRegistry.g.cs'] = this._efGen.generateMetaTableRegistry(metaTableDefs, 'SCHEMA_FINGERPRINT_PLACEHOLDER');
    }
    return files;
  }

  private generateStruct(s: DeukPackStruct, ast: DeukPackAST, ns: string): string[] {
    (this._structGen as any)._efCurrentRowInfo = (this as any)._efMetaRowInfo?.get(CSharpTypeHelper.getStructFullName(s, ast)) || null;
    return this._structGen.generateStruct(s, ast, ns);
  }

  private generateEnum(enm: DeukPackEnum): string[] {
    const lines = [`  public enum ${enm.name}\n  {`];
    for (const [k, v] of Object.entries(enm.values)) lines.push(`    ${k} = ${v},`);
    lines.push('  }');
    return lines;
  }

  private generateTypedef(td: DeukPackTypedef): string[] {
    return [`  using ${td.name} = ${CSharpTypeHelper.getCSharpType(td.type)};`];
  }

  private generateConstant(cn: any, ast: DeukPackAST): string[] {
    return [`  public const ${CSharpTypeHelper.getCSharpType(cn.type)} ${cn.name} = ${this.getCSharpDefaultValue(cn.value, cn.type, ast)};`];
  }

  private renderCSharpTpl(relPath: string, values: Record<string, string>): string {
    const tpl = this._tpl.load(relPath);
    return applyCodegenPlaceholders(tpl, values);
  }

  private getCSharpDefaultValue(v: any, t: any, _ast: any, _ns?: string) { 
    if (t === 'bool' || t === 'boolean') return v ? 'true' : 'false';
    if (t === 'float') return `${v}f`;
    if (t === 'double') return `${v}d`;
    if (t === 'string') return JSON.stringify(v);
    if (typeof v === 'bigint') return `${v}L`;
    if (t === 'int64' || t === 'i64') return `${v}L`;
    if (typeof v === 'number') return v.toString();
    if (this.isEnumType(t, _ast, _ns)) return `${CSharpTypeHelper.getCSharpType(t, _ast, _ns)}.${v}`;
    return typeof v === 'bigint' ? `${v}L` : JSON.stringify(v); 
  }
  
  // PROTECTED/PRIVATE ACCESSORS SILENCED
  public resolveTypeToFullName(t: string, _ns: string | undefined, _ast: any) { return t; }
  public findStruct(ast: any, f: string, _ns: string) { return ast.structs.find((s: any) => s.name === f); }
  public isTableRowType(s: any, _ast: any) { return !!s.annotations?.['table']; }
  public isStructCSharpType(_c: any, _ast: any) { return true; }
  public isEnumType(t: any, ast: any, _ns: any) { 
      return typeof t === 'string' && ast.enums.some((e: any) => e.name === t);
  }
  public isPrimitiveType(t: any, _ast: any, _ns: any) { 
      return typeof t === 'string' && ['bool','byte','int8','int16','int32','int64','float','double','string','binary','boolean','datetime', 'i8', 'i16', 'i32', 'i64', 'short', 'int', 'long'].includes(t.toLowerCase());
  }
  public isStructType(t: any, ast: any, _ns: any) { 
      if (typeof t !== 'string') return false;
      return !this.isPrimitiveType(t, ast, _ns) && !this.isEnumType(t, ast, _ns);
  }
  public isGeometryDeukStruct(_t: any, _ast: any, _ns: any) { return false; }
  public dictToCSharpAnnotations(_ann: any) { return 'null'; }

  private groupBySourceFile(ast: DeukPackAST): any {
    const groups: any = {};
    for (const s of ast.structs) {
        const f = (s as any).sourceFile || 'Generated.deuk';
        if (!groups[f]) groups[f] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
        groups[f].structs.push(s);
    }
    for (const e of ast.enums) {
        const f = (e as any).sourceFile || 'Generated.deuk';
        if (!groups[f]) groups[f] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
        groups[f].enums.push(e);
    }
    return groups;
  }

  private groupByNamespace(definitions: any): any {
    const groups: any = {};
    for (const s of definitions.structs) {
        const ns = (s as any).namespace || 'DefaultNamespace';
        if (!groups[ns]) groups[ns] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
        groups[ns].structs.push(s);
    }
    for (const e of definitions.enums) {
        const ns = (e as any).namespace || 'DefaultNamespace';
        if (!groups[ns]) groups[ns] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
        groups[ns].enums.push(e);
    }
    return groups;
  }
}