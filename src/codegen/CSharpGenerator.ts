import * as fsSync from 'fs';
import * as path from 'path';
import { DeukPackAST, GenerationOptions, DeukPackStruct, DeukPackEnum, DeukPackField, DeukPackTypedef, DeukPackException, DeukPackService, DeukPackType } from '../types/DeukPackTypes';
import { CodeGenerator } from './CodeGenerator';
import { csharpSuffixFromProfile, filterStructFieldsForProfile } from './WireProfileSubset';
import { DeukPackEngine } from '../core/DeukPackEngine';
import { applyCodegenPlaceholders } from './templateRender';
import { parseDeukNumericLiteral } from '../core/parseDeukNumericLiteral';
import { CodegenTemplateHost } from './codegenTemplateHost';

export class CSharpGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('csharp');
  async generate(ast: DeukPackAST, _options: GenerationOptions): Promise<{ [filename: string]: string }> {
    const enableNullable = _options.csharpNullable === true;
    (this as any)._csharpNullable = enableNullable;
    (this as any)._csharpVersion = _options.csharpVersion || 'net8.0';

    DeukPackEngine.resolveExtends(ast);
    // Generate separate files per IDL source file
    const files: { [filename: string]: string } = {};
    
    // Group by source file
    const fileGroups = this.groupBySourceFile(ast);
    const metaTableDefsEarly = this.collectMetaTableDefinitions(ast);
    const entityDefsEarly = this.collectEntityDefinitions(ast);
    this.validateTableLinkFields(ast, metaTableDefsEarly);
    // Row → [Table]/[Key]/[Column]: entity는 --csharp만으로 생성(EF Core·DbContext 불필요, Unity·구버전 호환용 DataAnnotations만).
    // *_meta 메타 테이블 행은 기존처럼 --ef 일 때만 동일 어노테이션(서버 전용 코드젠과 정합).
    const rowDbAnnotationMap = new Map<string, { category: string; keyFieldNames: string[] }>();
    for (const d of entityDefsEarly) {
      rowDbAnnotationMap.set(d.rowTypeFull, { category: d.category, keyFieldNames: d.keyFieldNames });
    }
    if (_options.efSupport) {
      for (const d of metaTableDefsEarly) {
        if (!rowDbAnnotationMap.has(d.rowTypeFull)) {
          rowDbAnnotationMap.set(d.rowTypeFull, { category: d.category, keyFieldNames: d.keyFieldNames });
        }
      }
    }
    (this as any)._efMetaRowInfo = rowDbAnnotationMap;

    for (const [sourceFile, definitions] of Object.entries(fileGroups)) {
      const lines: string[] = [];

      const docBlock = this._tpl.load('StandardDeukPackFileDoc.cs.tpl').trimEnd();
      const rowDbMap = (this as any)._efMetaRowInfo as Map<string, { category: string; keyFieldNames: string[] }>;
      const needsDataAnnotationsUsings = definitions.structs.some(
        (s: DeukPackStruct) => rowDbMap.has(this.getStructFullName(s, ast))
      );
      const efUsings = needsDataAnnotationsUsings
        ? 'using System.ComponentModel.DataAnnotations;\nusing System.ComponentModel.DataAnnotations.Schema;\n'
        : '';
      const headerText = this.renderCSharpTpl('CSharpMainFileHeader.cs.tpl', {
        DOC_BLOCK: docBlock,
        EF_USINGS: efUsings,
        NULLABLE_ENABLE: enableNullable ? '#nullable enable' : '',
      });
      lines.push(...headerText.replace(/\r\n/g, '\n').split('\n'));

      let emittedNamespaceBlock = false;

      // Group by namespace within this file
      const namespaceGroups = this.groupByNamespace({
        namespaces: ast.namespaces,
        structs: definitions.structs,
        enums: definitions.enums,
        services: definitions.services,
        typedefs: definitions.typedefs,
        constants: definitions.constants,
        includes: [],
        annotations: {}
      });

      // Determine if there is exactly one namespace across all groups
      const singleNamespace = _options.braceLessNamespace && Object.keys(namespaceGroups).length === 1;

      for (const [namespace, namespaceDefs] of Object.entries(namespaceGroups)) {
        // Skip empty namespaces (unless it's the root file and we should show something?)
        const hasContent = namespaceDefs.enums.length > 0 || 
                          namespaceDefs.structs.length > 0 || 
                          namespaceDefs.typedefs.length > 0 || 
                          namespaceDefs.constants.length > 0 ||
                          (namespaceDefs as any).services?.length > 0;
        
        if (!hasContent) {
          continue;
        }

        emittedNamespaceBlock = true;

        // Collect content lines for this namespace
        const contentLines: string[] = [];

        // Generate typedefs FIRST (must be at namespace start in C#)
        for (const typedef of namespaceDefs.typedefs) {
          contentLines.push(...this.generateTypedef(typedef));
          contentLines.push('');
        }

        // Generate enums
        for (const enumDef of namespaceDefs.enums) {
          contentLines.push(...this.generateEnum(enumDef));
          contentLines.push('');
        }

        // Generate structs (pass current namespace for default value resolution e.g. msgInfo = { "msgId": id_e.req_login })
        for (const struct of namespaceDefs.structs) {
          contentLines.push(...this.generateStruct(struct, ast, namespace));
          contentLines.push('');
        }

        if (namespaceDefs.constants.length > 0) {
          const constantLines = namespaceDefs.constants.flatMap((c) => this.generateConstant(c, ast)).join('\n');
          const constBlock = this.renderCSharpTpl('ConstantsClass.cs.tpl', { CONSTANT_LINES: constantLines });
          contentLines.push(...constBlock.replace(/\r\n/g, '\n').split('\n'));
          contentLines.push('');
        }

        // Generate services (interface + version helper)
        const services = (namespaceDefs as any).services as DeukPackService[] | undefined;
        if (services && services.length > 0) {
          for (const svc of services) {
            contentLines.push(...this.generateService(svc, ast, namespace));
            contentLines.push('');
          }
        }

        // Apply indentation reduction if singleNamespace is enabled
        const processedLines = singleNamespace 
          ? contentLines.map(line => line.startsWith('  ') ? line.substring(2) : line)
          : contentLines;

        const openTpl = singleNamespace ? 'NamespaceOpenSingle.cs.tpl' : 'NamespaceOpen.cs.tpl';
        const closeTpl = singleNamespace ? 'NamespaceCloseSingle.cs.tpl' : 'NamespaceClose.cs.tpl';

        lines.push(
          ...this.renderCSharpTpl(openTpl, { NAMESPACE: namespace }).replace(/\r\n/g, '\n').split('\n')
        );

        lines.push(...processedLines);

        lines.push(
          ...this.renderCSharpTpl(closeTpl, {}).replace(/\r\n/g, '\n').trimEnd().split('\n')
        );
        lines.push('');
      }

      if (!emittedNamespaceBlock) {
        continue;
      }

      // Generate filename from source file
      const filename = this.getFilenameFromSource(sourceFile);
      files[filename] = lines.join('\n');
    }

    // table 키워드: 테이블 저장소(매니저)용 레지스트리 코드 항상 자동생성. 메타 테이블이 있으면 switch에 등록 → 리플렉션 없이 타입 접근.
    const schemaFingerprint = this.computeSchemaFingerprint(ast);
    files['MetaTableRegistry.g.cs'] = this.generateMetaTableRegistry(metaTableDefsEarly, schemaFingerprint);

    if (_options.efSupport && (metaTableDefsEarly.length > 0 || entityDefsEarly.length > 0)) {
      files['DeukPackDbContext.g.cs'] = this.generateEfDbContext(metaTableDefsEarly, entityDefsEarly);
    }

    const profiles = (_options.wireProfilesEmit || []).map((p) => String(p).trim()).filter(Boolean);
    if (profiles.length > 0) {
      Object.assign(files, this.generateWireProfileSubsetFiles(ast, profiles));
    }

    return files;
  }

  /**
   * Extra C# files: per profile, struct types `{ShortName}{Suffix}` with only fields allowed for that profile.
   * Wire record name and GetSchema().Name stay the original struct name; field IDs unchanged.
   */
  private generateWireProfileSubsetFiles(ast: DeukPackAST, profiles: string[]): { [filename: string]: string } {
    const out: { [filename: string]: string } = {};
    const prevSuffix = (this as any)._wireProfileStructSuffix as string | undefined;
    const prevSet = (this as any)._wireProfileSubsetFullNames as Set<string> | undefined;
    try {
      for (const profile of profiles) {
        const profileLower = profile.toLowerCase();
        const suffix = csharpSuffixFromProfile(profile);
        const subsetFullNames = new Set<string>();
        for (const s of ast.structs || []) {
          const filtered = filterStructFieldsForProfile(s, profileLower);
          if (filtered.length > 0) subsetFullNames.add(this.getStructFullName(s, ast));
        }
        if (subsetFullNames.size === 0) continue;

        (this as any)._wireProfileStructSuffix = suffix;
        (this as any)._wireProfileSubsetFullNames = subsetFullNames;

        const lines: string[] = [];
        const wpHeader = this.renderCSharpTpl('CSharpWireProfileFileHeader.cs.tpl', {
          PROFILE_ESCAPED: this.escapeCSharpStringContent(profile),
        });
        lines.push(...wpHeader.replace(/\r\n/g, '\n').split('\n'));

        const namespaceGroups = this.groupByNamespace(ast);
        for (const [namespace, namespaceDefs] of Object.entries(namespaceGroups)) {
          const structs = namespaceDefs.structs || [];
          const anySubset = structs.some((st) => filterStructFieldsForProfile(st, profileLower).length > 0);
          if (!anySubset) continue;

          lines.push(
            ...this.renderCSharpTpl('NamespaceOpen.cs.tpl', { NAMESPACE: namespace }).replace(/\r\n/g, '\n').split('\n')
          );

          for (const struct of structs) {
            const filtered = filterStructFieldsForProfile(struct, profileLower);
            if (filtered.length === 0) continue;
            const shortName = struct.name.includes('.') ? (struct.name.split('.').pop() ?? struct.name) : struct.name;
            const subsetStruct: DeukPackStruct = { ...struct, fields: filtered };
            lines.push(
              ...this.generateStruct(subsetStruct, ast, namespace, {
                csharpClassName: shortName + suffix,
                wireSchemaName: struct.name
              })
            );
            lines.push('');
          }

          lines.push(
            ...this.renderCSharpTpl('NamespaceClose.cs.tpl', {}).replace(/\r\n/g, '\n').trimEnd().split('\n')
          );
          lines.push('');
        }

        const safeFile = profile.replace(/[^a-zA-Z0-9]+/g, '_');
        out[`WireProfile.${safeFile}.g.cs`] = lines.join('\n');
      }
    } finally {
      (this as any)._wireProfileStructSuffix = prevSuffix;
      (this as any)._wireProfileSubsetFullNames = prevSet;
    }
    return out;
  }



  private renderCSharpTpl(relPath: string, values: Record<string, string>): string {
    const enableNullable = (this as any)._csharpNullable === true;
    const placeholderValues = {
      ...values,
      '?': enableNullable ? '?' : '',
    };
    return applyCodegenPlaceholders(this._tpl.load(relPath), placeholderValues);
  }

  /** Entity Framework Core: DbContext + DbSet. meta table + entity 모두 지원. */
  private generateEfDbContext(
    metaTableDefs: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }>,
    entityDefs: Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> = []
  ): string {
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const toPropExpr = (cols: string[]) => {
      const props = cols.map(c => `e.${capitalize(c)}`);
      return cols.length === 1 ? props[0] : `new { ${props.join(', ')} }`;
    };

    const dbSetLines: string[] = [];
    for (const d of metaTableDefs) {
      const propName = capitalize(d.category);
      dbSetLines.push(`    public DbSet<${d.rowTypeFull}> ${propName} => Set<${d.rowTypeFull}>();`);
    }
    for (const d of entityDefs) {
      const propName = capitalize(d.category) + 's';
      dbSetLines.push(`    public DbSet<${d.rowTypeFull}> ${propName} => Set<${d.rowTypeFull}>();`);
    }
    const dbSetProps = dbSetLines.length ? dbSetLines.join('\n') + '\n' : '';

    const onModelBodyLines: string[] = [];
    for (const d of metaTableDefs) {
      onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().ToTable("${this.escapeCSharpStringContent(d.category)}");`);
      if (d.keyFieldNames.length > 1) {
        onModelBodyLines.push(
          `      modelBuilder.Entity<${d.rowTypeFull}>().HasKey(e => ${toPropExpr(d.keyFieldNames)});`
        );
      }
    }
    for (const d of entityDefs) {
      onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().ToTable("${this.escapeCSharpStringContent(d.category)}");`);
      if (d.keyFieldNames.length > 1) {
        onModelBodyLines.push(
          `      modelBuilder.Entity<${d.rowTypeFull}>().HasKey(e => ${toPropExpr(d.keyFieldNames)});`
        );
      }
      for (const idx of d.indexColumns) {
        onModelBodyLines.push(
          `      modelBuilder.Entity<${d.rowTypeFull}>().HasIndex(e => ${toPropExpr(idx)});`
        );
      }
      for (const uq of d.uniqueColumns) {
        onModelBodyLines.push(
          `      modelBuilder.Entity<${d.rowTypeFull}>().HasIndex(e => ${toPropExpr(uq)}).IsUnique();`
        );
      }
    }
    const onModelBody = onModelBodyLines.length === 0 ? '' : onModelBodyLines.join('\n') + '\n';
    const tpl = this._tpl.load('DeukPackDbContext.cs.tpl');
    return `${applyCodegenPlaceholders(tpl, { DBSET_PROPERTIES: dbSetProps, ONMODEL_BODY: onModelBody }).trimEnd()}\n`;
  }

  /** tablelink<Table, Key>: 대상 테이블 row 타입에 지정한 키 필드가 없으면 오류. */
  private validateTableLinkFields(ast: DeukPackAST, metaTableDefs: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }>): void {
    for (const struct of ast.structs || []) {
      for (const field of struct.fields || []) {
        const t = field.type;
        if (typeof t !== 'object' || !t || (t as any).type !== 'tablelink') continue;
        const tableCategory = (t as any).tableCategory as string;
        const keyField = (t as any).keyField as string;
        const def = metaTableDefs.find(
          (d) => d.category === tableCategory || d.containerTypeFull.startsWith(tableCategory + '.')
        );
        if (!def) continue;
        const rowTypeFull = def.rowTypeFull;
        const rowStruct = ast.structs?.find((s) => {
          const ns = this.getStructNamespace(s, ast);
          return (ns ? ns + '.' : '') + s.name === rowTypeFull;
        });
        const hasKey = rowStruct?.fields?.some((f) => f.name === keyField);
        const hasLegacyMid = keyField === 'tuid' && rowStruct?.fields?.some((f) => f.name === 'meta_id');
        if (!hasKey && !hasLegacyMid) {
          throw new DeukPackException(
            `tablelink<${tableCategory}, ${keyField}>: 대상 테이블 row 타입 "${rowTypeFull}"에 키 필드 "${keyField}"가 없습니다.`
          );
        }
      }
    }
  }

  /** include 포함 전체 AST 기준 와이어/구조 영향 스키마 지문. 정의 변경 시 값이 바뀌어 스키마 버전 변경 여부를 코드젠 수준에서 판단 가능. */
  private computeSchemaFingerprint(ast: DeukPackAST): string {
    const parts: string[] = [];
    const nsList = [...(ast.namespaces || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const ns of nsList) {
      parts.push(`ns:${ns.name}`);
    }
    const structs = [...(ast.structs || [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const s of structs) {
      parts.push(`record:${s.name}`);
      const fields = [...(s.fields || [])].sort((a, b) => a.id - b.id);
      for (const f of fields) {
        parts.push(`f:${f.id}:${f.name}:${this.canonicalTypeStringForFingerprint(f.type)}`);
      }
    }
    const enums = [...(ast.enums || [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const e of enums) {
      const vals = Object.entries(e.values || {}).sort(([k1], [k2]) => k1.localeCompare(k2));
      parts.push(`enum:${e.name}:${vals.map(([k, v]) => `${k}=${v}`).join(',')}`);
    }
    const typedefs = [...(ast.typedefs || [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const t of typedefs) {
      parts.push(`typedef:${t.name}:${this.canonicalTypeStringForFingerprint(t.type)}`);
    }
    const str = parts.join('|');
    const h = this.djb2Hash(str);
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  private canonicalTypeStringForFingerprint(type: any): string {
    if (type == null) return '?';
    if (typeof type === 'string') return type;
    if (typeof type === 'object') {
      if (type.type === 'list') return `list<${this.canonicalTypeStringForFingerprint(type.elementType)}>`;
      if (type.type === 'array')
        return `array<${this.canonicalTypeStringForFingerprint(type.elementType)},${type.size}>`;
      if (type.type === 'set') return `set<${this.canonicalTypeStringForFingerprint(type.elementType)}>`;
      if (type.type === 'map') return `map<${this.canonicalTypeStringForFingerprint(type.keyType)},${this.canonicalTypeStringForFingerprint(type.valueType)}>`;
      if (type.type === 'tablelink') return `tablelink<${type.tableCategory},${type.keyField}>`;
    }
    return String(type);
  }

  private djb2Hash(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
    }
    return h;
  }

  /** 메타 테이블(table/container) 목록 수집: 카테고리, 컨테이너 타입 풀네임, row 타입 풀네임, 키 필드명 목록 */
  private collectMetaTableDefinitions(ast: DeukPackAST): Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }> {
    const list: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }> = [];
    for (const struct of ast.structs || []) {
      if (!this.isMetaContainerStruct(struct)) continue;
      const ns = this.getStructNamespace(struct, ast);
      if (!ns || !ns.endsWith('_meta')) continue;
      const category = ns.replace(/_meta$/, '');
      const containerTypeFull = `${ns}.${struct.name}`;
      const infosType = struct.fields && struct.fields[1] && typeof struct.fields[1].type === 'object' && (struct.fields[1].type as { type?: string; valueType?: any }).type === 'map'
        ? (struct.fields[1].type as { valueType: any }).valueType
        : null;
      const rowTypeShort = infosType ? this.getCSharpType(infosType, ast, ns) : 'IDeukPack';
      const rowTypeFull = rowTypeShort.includes('.') ? rowTypeShort : `${ns}.${rowTypeShort}`;
      let keyFieldNames = struct.keyFieldNames;
      if (!keyFieldNames?.length && struct.annotations?.['key']) {
        const raw = String(struct.annotations['key']).replace(/^["']|["']$/g, '').trim();
        if (raw) keyFieldNames = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (!keyFieldNames?.length) keyFieldNames = ['tuid'];
      list.push({ category, containerTypeFull, rowTypeFull, keyFieldNames });
    }
    return list;
  }

  /** entity 키워드 struct 수집: [Table]/[Key]/[Column]은 --csharp만으로 생성. DbContext·Fluent는 --ef 전용. */
  private collectEntityDefinitions(ast: DeukPackAST): Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> {
    const list: Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> = [];
    for (const struct of ast.structs || []) {
      if (struct.declarationKind !== 'entity') continue;
      const ns = this.getStructNamespace(struct, ast);
      const fullName = ns ? `${ns}.${struct.name}` : struct.name;
      const bracketTable = this.findDeukBracketTagValue(struct.deukBracketAttributes, 'table');
      const tableName =
        bracketTable ??
        (struct.annotations?.['table']
          ? String(struct.annotations['table']).replace(/^["']|["']$/g, '').trim()
          : struct.name);
      let keyFieldNames = struct.keyFieldNames;
      if (!keyFieldNames?.length && struct.annotations?.['key']) {
        const raw = String(struct.annotations['key']).replace(/^["']|["']$/g, '').trim();
        if (raw) keyFieldNames = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (!keyFieldNames?.length) {
        const fromFields = this.collectKeyFieldNamesFromDeukFieldKeys(struct);
        if (fromFields.length) keyFieldNames = fromFields;
      }
      if (!keyFieldNames?.length) keyFieldNames = ['id'];
      const indexColumns: string[][] = [];
      const uniqueColumns: string[][] = [];
      if (struct.annotations?.['index']) {
        for (const group of String(struct.annotations['index']).replace(/^["']|["']$/g, '').split(';')) {
          const cols = group.split(',').map(s => s.trim()).filter(Boolean);
          if (cols.length) indexColumns.push(cols);
        }
      }
      if (struct.annotations?.['unique']) {
        for (const group of String(struct.annotations['unique']).replace(/^["']|["']$/g, '').split(';')) {
          const cols = group.split(',').map(s => s.trim()).filter(Boolean);
          if (cols.length) uniqueColumns.push(cols);
        }
      }
      list.push({ category: tableName, rowTypeFull: fullName, keyFieldNames, indexColumns, uniqueColumns });
    }
    return list;
  }

  /** `[table:x]` / `[schema:x]` 등 neutral 태그에서 값만 추출 */
  private findDeukBracketTagValue(attrs: string[] | undefined, baseNameLower: string): string | undefined {
    if (!attrs) return undefined;
    for (const t of attrs) {
      const head = ((t.split(':')[0] ?? '').split('(')[0] ?? '').trim().toLowerCase();
      if (head !== baseNameLower) continue;
      const idx = t.indexOf(':');
      if (idx < 0) return '';
      const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      return v || undefined;
    }
    return undefined;
  }

  private collectKeyFieldNamesFromDeukFieldKeys(struct: DeukPackStruct): string[] {
    const keys: string[] = [];
    for (const f of struct.fields ?? []) {
      for (const t of f.deukBracketAttributes ?? []) {
        const head = ((t.split(':')[0] ?? '').split('(')[0] ?? '').trim().toLowerCase();
        if (head === 'key') keys.push(f.name);
      }
    }
    return keys;
  }

  private fieldHasDeukBracketBase(field: DeukPackField, baseLower: string): boolean {
    for (const t of field.deukBracketAttributes ?? []) {
      const head = ((t.split(':')[0] ?? '').split('(')[0] ?? '').trim().toLowerCase();
      if (head === baseLower) return true;
    }
    return false;
  }

  /** MetaTableRegistry.g.cs 생성 — GetContainerType/GetRowType/GetKeyFieldNames/CreateEmptyTemplate, SchemaFingerprint, 리플렉션 제거 */
  private generateMetaTableRegistry(defs: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }>, schemaFingerprint: string): string {
    const switchGetContainer = defs
      .map((d) => `        case "${this.escapeCSharpStringContent(d.category)}": return typeof(${d.containerTypeFull});`)
      .join('\n');
    const switchGetRow = defs
      .map((d) => `        case "${this.escapeCSharpStringContent(d.category)}": return typeof(${d.rowTypeFull});`)
      .join('\n');
    const switchGetKeys = defs
      .map((d) => {
        const arrLiteral =
          'new string[] { ' + d.keyFieldNames.map((k: string) => `"${this.escapeCSharpStringContent(k)}"`).join(', ') + ' }';
        return `        case "${this.escapeCSharpStringContent(d.category)}": return ${arrLiteral};`;
      })
      .join('\n');
    const switchCreateEmpty = defs
      .map(
        (d) =>
          `        case "${this.escapeCSharpStringContent(d.category)}": return (IDeukMetaContainer)${d.containerTypeFull}.CreateDefault();`
      )
      .join('\n');
    const text = this.renderCSharpTpl('MetaTableRegistry.cs.tpl', {
      FINGERPRINT: this.escapeCSharpStringContent(schemaFingerprint),
      SWITCH_GETCONTAINER: switchGetContainer,
      SWITCH_GETROW: switchGetRow,
      SWITCH_GETKEYS: switchGetKeys,
      SWITCH_CREATEEMPTY: switchCreateEmpty,
    });
    return `${text.replace(/\r\n/g, '\n').trimEnd()}\n`;
  }

  private groupBySourceFile(ast: DeukPackAST): { [sourceFile: string]: { enums: DeukPackEnum[], structs: DeukPackStruct[], typedefs: any[], constants: any[], services: DeukPackService[] } } {
    const groups: { [sourceFile: string]: { enums: DeukPackEnum[], structs: DeukPackStruct[], typedefs: any[], constants: any[], services: DeukPackService[] } } = {};
    
    const ensure = (sourceFile: string) => {
      if (!groups[sourceFile]) {
        groups[sourceFile] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
      }
    };
    for (const enumDef of ast.enums) {
      const sourceFile = enumDef.sourceFile || 'unknown';
      ensure(sourceFile);
      groups[sourceFile]!.enums.push(enumDef);
    }
    for (const struct of ast.structs) {
      const sourceFile = struct.sourceFile || 'unknown';
      ensure(sourceFile);
      groups[sourceFile]!.structs.push(struct);
    }
    for (const typedef of ast.typedefs) {
      const sourceFile = typedef.sourceFile || 'unknown';
      ensure(sourceFile);
      groups[sourceFile]!.typedefs.push(typedef);
    }
    for (const constant of ast.constants) {
      const sourceFile = constant.sourceFile || 'unknown';
      ensure(sourceFile);
      groups[sourceFile]!.constants.push(constant);
    }
    for (const service of ast.services) {
      const sourceFile = service.sourceFile || 'unknown';
      ensure(sourceFile);
      groups[sourceFile]!.services.push(service);
    }
    return groups;
  }

  private getFilenameFromSource(sourceFile: string): string {
    // Extract filename without extension and path
    const filename = sourceFile.split('/').pop()?.split('\\').pop() || 'unknown';
    let nameWithoutExt = filename.replace(/\.thrift$/i, '').replace(/\.deuk$/i, '').replace(/\.proto$/i, '');
    
    // .Thrift.cs 같은 중복 확장자 방지
    if (nameWithoutExt.endsWith('.Thrift') || nameWithoutExt.endsWith('.thrift')) {
      const baseName = nameWithoutExt.replace(/\.(Thrift|thrift)$/i, '');
      return `${baseName}_deuk.cs`;
    }
    
    // Windows 예약어 방지 (COM, PRN, AUX, NUL, CON, LPT1-9 등)
    const windowsReservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const upperName = nameWithoutExt.toUpperCase();
    
    if (windowsReservedNames.includes(upperName) || nameWithoutExt === '' || nameWithoutExt === 'nul') {
      return 'unknown_deuk.cs';
    }
    
    return `${nameWithoutExt}_deuk.cs`;
  }

  private generateEnum(enumDef: DeukPackEnum): string[] {
    const docBlock = this._tpl.load('StandardDeukPackFileDoc.cs.tpl').trimEnd();
    const enumAttrs = enumDef.csharpAttributes;
    const enumAttrBlock = enumAttrs?.length ? enumAttrs.map((attr) => `  ${attr}`).join('\n') + '\n' : '';
    const entryLines: string[] = [];
    const entries = Object.entries(enumDef.values);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        const [name, value] = entry;
        const comma = i < entries.length - 1 ? ',' : '';
        const comment = enumDef.valueComments?.[name];
        if (comment) {
          const escaped = comment.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
          entryLines.push(`    [System.ComponentModel.Description("${escaped}")]`);
        }
        entryLines.push(`    ${name} = ${value}${comma}`);
      }
    }
    const text = this.renderCSharpTpl('Enum.cs.tpl', {
      DOC_BLOCK: docBlock,
      ENUM_ATTRS: enumAttrBlock,
      ENUM_NAME: enumDef.name,
      ENUM_ENTRIES: entryLines.join('\n'),
    });
    return text.replace(/\r\n/g, '\n').split('\n');
  }

  /** 테이블 행 타입 여부: 어떤 meta container의 infos map value type으로 쓰이는지 */
  private isTableRowType(struct: DeukPackStruct, ast: DeukPackAST): boolean {
    const rowNs = this.getStructNamespace(struct, ast);
    const rowFull = `${rowNs}.${struct.name}`;
    for (const s of ast.structs || []) {
      if (!this.isMetaContainerStruct(s) || !s.fields || s.fields.length < 2) continue;
      const infosType = s.fields[1]!.type;
      if (typeof infosType !== 'object' || !infosType || (infosType as { type?: string }).type !== 'map') continue;
      const valueType = (infosType as { valueType?: any }).valueType;
      if (!valueType) continue;
      const containerNs = this.getStructNamespace(s, ast);
      const rowTypeShort = this.getCSharpType(valueType, ast, containerNs);
      const rowTypeFull = rowTypeShort.includes('.') ? rowTypeShort : `${containerNs}.${rowTypeShort}`;
      if (rowTypeFull === rowFull) return true;
    }
    return false;
  }

  private generateStruct(
    struct: DeukPackStruct,
    ast: DeukPackAST,
    currentNamespace?: string,
    emitOpts?: { csharpClassName: string; wireSchemaName: string }
  ): string[] {
    if (!emitOpts && struct.annotations?.['geometry']) {
      return this.generateGeometryStruct(struct, ast, currentNamespace);
    }
    const ns = currentNamespace ?? this.getStructNamespace(struct, ast);
    const fullName = this.getStructFullName(struct, ast);
    const className = emitOpts?.csharpClassName ?? struct.name;
    const wireName = emitOpts?.wireSchemaName ?? struct.name;
    const isWireProfileSubset = !!emitOpts;
    const rowDbMap = (this as any)._efMetaRowInfo as Map<string, { category: string; keyFieldNames: string[] }>;
    const efInfo = isWireProfileSubset ? null : rowDbMap.get(fullName) ?? null;
    (this as any)._efCurrentRowInfo = efInfo;

    // 테이블 행 record: 1-4번 예약. 5번부터만 사용. 옵션 tableRowReserved14 시 1-4 사용하면 컴파일 오류
    const opts = (this as any)._genOptions as { tableRowReserved14?: boolean } | undefined;
    if (opts?.tableRowReserved14 && this.isTableRowType(struct, ast) && struct.fields) {
      const reserved = [1, 2, 3, 4];
      for (const f of struct.fields) {
        const id = typeof f.id === 'number' ? f.id : parseInt(String(f.id), 10);
        if (!isNaN(id) && reserved.includes(id)) {
          throw new Error(
            `Table row record '${struct.name}' must not use field indices 1-4 (reserved for tuid, tid, name, note). Use 5 and above. Invalid field: ${f.id} ${f.name}`
          );
        }
      }
    }

    const structAttrs = struct.csharpAttributes;
    const structAttrBlock = structAttrs?.length ? structAttrs.map((attr) => `  ${attr}`).join('\n') + '\n' : '';
    const entityTableHint =
      struct.declarationKind === 'entity' ? this.findDeukBracketTagValue(struct.deukBracketAttributes, 'table') : undefined;
    const entitySchemaHint =
      struct.declarationKind === 'entity' ? this.findDeukBracketTagValue(struct.deukBracketAttributes, 'schema') : undefined;
    let tableAttr = '';
    if (struct.declarationKind === 'entity') {
      const tName = entityTableHint ?? efInfo?.category;
      if (tName) {
        const schemaPart = entitySchemaHint
          ? `, Schema = "${this.escapeCSharpStringContent(entitySchemaHint)}"`
          : '';
        tableAttr = `  [Table("${this.escapeCSharpStringContent(tName)}"${schemaPart})]\n`;
      }
    } else if (efInfo) {
      tableAttr = `  [Table("${this.escapeCSharpStringContent(efInfo.category)}")]\n`;
    }
    const isMetaContainer = this.isMetaContainerStruct(struct);
    const metaContainerDataType =
      isMetaContainer && struct.fields && struct.fields.length >= 2
        && typeof struct.fields[1]!.type === 'object' && struct.fields[1]!.type && (struct.fields[1]!.type as { type?: string }).type === 'map'
        ? this.getCSharpType((struct.fields[1]!.type as { valueType: any }).valueType, ast, ns)
        : null;
    const implList = ['IDeukPack'];
    if (isMetaContainer) implList.push('IDeukMetaContainer');
    if (metaContainerDataType) implList.push(`IDeukMetaContainer<${metaContainerDataType}>`);
    const implListStr = implList.join(', ');

    const fieldLinesFlat = struct.fields.flatMap((f) => this.generateField(f, ast, ns, struct));
    const fieldsBlock = fieldLinesFlat.length > 0 ? '\n' + fieldLinesFlat.join('\n') : '';

    let fieldIdBlock = '';
    if (struct.fields.length > 0) {
      fieldIdBlock =
        '\n\n    public static class FieldId\n    {\n' +
        struct.fields.map((f) => `      public const int ${this.capitalize(f.name)} = ${f.id};`).join('\n') +
        '\n    }';
    }

    const defaultProps: string[] = [];
    let msgIdLikeFieldName: string | null = null;
    for (const field of struct.fields) {
      const defaultExpr = this.getFieldDefaultExpression(field, ast, ns, struct);
      if (defaultExpr === null) continue;
      const csharpType = this.getCSharpType(field.type, ast, ns);
      const propName = this.capitalize(field.name);
      defaultProps.push(`    public static ${csharpType} Default_${propName} => ${defaultExpr};`);
      if (typeof field.type === 'string' && ast) {
        const typeFull = this.resolveTypeToFullName(field.type, ns, ast);
        const targetStruct = this.findStruct(ast, typeFull, ns);
        if (targetStruct?.fields?.some((f) => f.name.toLowerCase() === 'msgid')) {
          msgIdLikeFieldName = propName;
        }
      }
    }
    let defaultBlock = '';
    if (defaultProps.length > 0) {
      defaultBlock +=
        '\n    // 기본값 정적 노출 (enum/구조체 공통, 리플렉션 없이 조회)\n' + defaultProps.join('\n');
    }
    if (msgIdLikeFieldName !== null) {
      defaultBlock +=
        `\n    // Message ID for protocol handler registration (Default_* combination)\n    public static int DefaultMessageId => Default_${msgIdLikeFieldName}.MsgId;`;
    }
    defaultBlock += '\n';

    const writeUnifiedInner = this.generateWriteUnifiedInner(struct, ast, ns, wireName);

    const requiredFields = struct.fields.filter((f) => f.required);
    const readSeenInitLines =
      requiredFields.length > 0
        ? requiredFields.map((f) => `      bool __read_${f.id} = false;`).join('\n') + '\n'
        : '';
    const readInitLines =
      readSeenInitLines +
      struct.fields
        .map((field) => {
          const fieldName = this.capitalize(field.name);
          const rhs = this.generateCreateDefaultRhs(field, ast, ns, struct);
          return `      this.${fieldName} = ${rhs};`;
        })
        .join('\n');

    const readSwitchCases: string[] = [];
    for (const field of struct.fields) {
      readSwitchCases.push('          case ' + field.id + ':');
      readSwitchCases.push('            if (field.Type == ' + this.getTType(field.type, ast, ns) + ' || field.Type == DpWireType.Void)');
      readSwitchCases.push('            {');
      if (field.required) readSwitchCases.push('              __read_' + field.id + ' = true;');
      readSwitchCases.push('              ' + this.generateReadField(field, ast, ns));
      const parentName = this.capitalize(field.name);
      const hasDefault = field.defaultValue !== undefined;
      const isStructField =
        typeof field.type === 'string' &&
        ast &&
        (this.isStructType(field.type, ast, ns) || this.isStructCSharpType(this.getCSharpType(field.type, ast, ns), ast));
      if (hasDefault && isStructField && typeof field.type === 'string') {
        for (const ensureLine of this.generateEnsureNestedDefaults(parentName, field.type, ast, ns)) {
          readSwitchCases.push('              ' + ensureLine);
        }
      }
      readSwitchCases.push('            }');
      readSwitchCases.push('            else');
      readSwitchCases.push('            {');
      readSwitchCases.push('              DpProtocolUtil.Skip(iprot, field.Type);');
      readSwitchCases.push('            }');
      readSwitchCases.push('            break;');
    }
    const readSwitchCasesStr = readSwitchCases.join('\n');
    const readMissingRequiredChecks =
      requiredFields.length > 0
        ? requiredFields
            .map(
              (f) =>
                `      if (!__read_${f.id}) DeukPack.Protocol.DeukPackSerializationWarnings.LogMissingRequiredField("${this.escapeCSharpStringContent(wireName)}", "${this.escapeCSharpStringContent(f.name)}");`
            )
            .join('\n')
        : '';

    const cloneLines = struct.fields
      .map((field) => '      ' + this.generateCloneField(field, this.capitalize(field.name), ast, ns))
      .join('\n');

    const createDefaultLines = struct.fields
      .map((field) => {
        const fieldName = this.capitalize(field.name);
        const rhs = this.generateCreateDefaultRhs(field, ast, ns, struct);
        return '      o.' + fieldName + ' = ' + rhs + ';';
      })
      .join('\n');

    let toStringInner: string;
    if (struct.fields.length === 0) {
      toStringInner = '      sb.Append("}");';
    } else {
      toStringInner =
        '      sb.AppendLine();\n' +
        struct.fields.map((f) => '      ' + this.generateToStringField(f, this.capitalize(f.name), ast, ns)).join('\n') +
        '\n      sb.Append(indent).Append("}");';
    }

    (this as any)._efCurrentRowInfo = null;

    const structDoc = (struct as any).docComment != null ? this.escapeCSharpString((struct as any).docComment) : 'null';
    const structAnn =
      (struct as any).annotations != null && Object.keys((struct as any).annotations).length > 0
        ? this.dictToCSharpAnnotations((struct as any).annotations)
        : 'null';

    const structFields = struct.fields ?? [];
    const schemaFieldLines = structFields
      .map((f, orderIdx) => `          { ${f.id}, ${this.generateFieldSchema(f, ast, ns, orderIdx)} },`)
      .join('\n');

    let metaContainerBlock = '';
    if (isMetaContainer && struct.fields.length >= 2) {
      const headerField = struct.fields[0]!;
      const infosField = struct.fields[1]!;
      const headerType = this.getCSharpType(headerField.type, ast, ns);
      const infosValueType =
        typeof infosField.type === 'object' && infosField.type && infosField.type.type === 'map'
          ? this.getCSharpType(infosField.type.valueType, ast, ns)
          : 'IDeukPack';
      metaContainerBlock =
        '\n    // IDeukMetaContainer: 리플렉션 없이 메타 매니저에서 접근\n' +
        `    object IDeukMetaContainer.Header { get => Header; set => Header = (${headerType})value; }\n` +
        `    IReadOnlyDictionary<long, IDeukPack> IDeukMetaContainer.Infos => new DpMetaInfosWrapper<${infosValueType}>(Infos);\n` +
        '    // IDeukMetaContainer<T>: 데이터 타입 지정 접근\n' +
        `    IReadOnlyDictionary<long, ${infosValueType}> IDeukMetaContainer<${infosValueType}>.Data => Infos;`;
    }

    const nameToIdFallbackLines = struct.fields.map(f => `          if (field.Name == "${f.name}") field.ID = ${f.id};`).join('\n          else ');
    const nameToIdFallbackStr = struct.fields.length > 0
      ? `        if (field.ID == 0 && !string.IsNullOrEmpty(field.Name))\n        {\n${nameToIdFallbackLines}\n        }`
      : '';

    const wireEsc = this.escapeCSharpStringContent(wireName);
    const docBlock = this._tpl.load('StandardDeukPackFileDoc.cs.tpl').trimEnd();
    const rendered = this.renderCSharpTpl('StructRecord.cs.tpl', {
      DOC_BLOCK: docBlock,
      STRUCT_ATTRS: structAttrBlock,
      TABLE_ATTR: tableAttr,
      CLASS_NAME: className,
      IMPL_LIST: implListStr,
      FIELDS: fieldsBlock,
      FIELD_ID_BLOCK: fieldIdBlock,
      DEFAULT_BLOCK: defaultBlock,
      WIRE_NAME: wireEsc,
      WRITE_UNIFIED_INNER: writeUnifiedInner,
      READ_INIT_LINES: readInitLines,
      NAME_TO_ID_FALLBACK: nameToIdFallbackStr,
      READ_SWITCH_CASES: readSwitchCasesStr,
      READ_MISSING_REQUIRED_CHECKS: readMissingRequiredChecks,
      CLONE_LINES: cloneLines,
      CREATE_DEFAULT_LINES: createDefaultLines,
      TOSTRING_INNER: toStringInner,
      STRUCT_DOC: structDoc,
      STRUCT_ANN: structAnn,
      SCHEMA_FIELD_LINES: schemaFieldLines,
      META_CONTAINER_BLOCK: metaContainerBlock,
    });
    return rendered.replace(/\r\n/g, '\n').split('\n');
  }


  /** table 키워드: struct 이름이 table 또는 container(호환)이고 header + infos(map) 필드면 메타 테이블로 간주 */
  private isMetaContainerStruct(struct: DeukPackStruct): boolean {
    if ((struct.name !== 'table' && struct.name !== 'container') || !struct.fields || struct.fields.length < 2) return false;
    const a = struct.fields[0]!.name.toLowerCase();
    const b = struct.fields[1]!.name.toLowerCase();
    if (a !== 'header' || b !== 'infos') return false;
    const infosType = struct.fields[1]!.type;
    return typeof infosType === 'object' && infosType !== null && (infosType as { type?: string }).type === 'map';
  }

  private generateFieldSchema(field: DeukPackField, ast: DeukPackAST, currentNamespace?: string, order: number = 0): string {
    const typeInfo = this.getSchemaTypeInfo(field.type, ast, currentNamespace);
    const defaultValue =
      field.defaultValue !== undefined ? this.serializeDefaultValueToSchemaExpression(field.defaultValue) : 'null';
    const docComment = (field as any).docComment != null ? this.escapeCSharpString((field as any).docComment) : 'null';
    const annotations =
      (field as any).annotations != null && Object.keys((field as any).annotations).length > 0
        ? this.dictToCSharpAnnotations((field as any).annotations)
        : 'null';
    return this.renderCSharpTpl('DpFieldSchema.cs.tpl', {
      FIELD_ID: String(field.id),
      FIELD_ORDER: String(order),
      FIELD_NAME_ESCAPED: this.escapeCSharpStringContent(field.name),
      FIELD_SCHEMA_TYPE: typeInfo.type,
      FIELD_TYPE_NAME_ESCAPED: this.escapeCSharpStringContent(typeInfo.typeName),
      FIELD_REQUIRED: field.required ? 'true' : 'false',
      FIELD_DEFAULT_VALUE: defaultValue,
      FIELD_DOC_COMMENT: docComment,
      FIELD_ANNOTATIONS: annotations,
    }).replace(/\r\n/g, '\n');
  }

  /** Full C# string literal including quotes (e.g. for DocComment = "..." ). */
  private escapeCSharpString(s: string): string {
    if (s == null) return 'null';
    return '"' + this.escapeCSharpStringContent(s) + '"';
  }

  /** Escape content for use inside C# "..." (no surrounding quotes). */
  private escapeCSharpStringContent(s: string): string {
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  }

  private dictToCSharpAnnotations(ann: { [key: string]: string }): string {
    if (!ann || Object.keys(ann).length === 0) return 'null';
    const entries = Object.entries(ann).map(([k, v]) => `{ ${this.escapeCSharpString(k)}, ${this.escapeCSharpString(v)} }`).join(', ');
    return `new Dictionary<string, string> { ${entries} }`;
  }
  
  /** 득팩 표준 타입명으로 TypeName 반환 (엑셀 Row2 등). 레거시 i16/i32/i64 → int16/int32/int64, list→요소타입만, map→map<K,V>. */
  private getSchemaTypeInfo(type: any, ast: DeukPackAST, currentNamespace?: string): { type: string, typeName: string } {
    const legacyToStandard: { [key: string]: string } = { 'i8': 'int8', 'i16': 'int16', 'i32': 'int32', 'i64': 'int64' };
    const toStandardTypeName = (t: string): string => legacyToStandard[t] ?? t;

    if (typeof type === 'string') {
      const primitiveTypes: { [key: string]: string } = {
        'bool': 'DpSchemaType.Bool',
        'byte': 'DpSchemaType.Byte',
        'int8': 'DpSchemaType.Byte',
        'int16': 'DpSchemaType.Int16',
        'int32': 'DpSchemaType.Int32',
        'int64': 'DpSchemaType.Int64',
        'uint8': 'DpSchemaType.Byte',
        'uint16': 'DpSchemaType.Int16',
        'uint32': 'DpSchemaType.Int32',
        'uint64': 'DpSchemaType.Int64',
        'i8': 'DpSchemaType.Byte',
        'i16': 'DpSchemaType.Int16',
        'i32': 'DpSchemaType.Int32',
        'i64': 'DpSchemaType.Int64',
        'float': 'DpSchemaType.Double',
        'double': 'DpSchemaType.Double',
        'string': 'DpSchemaType.String',
        'binary': 'DpSchemaType.Binary',
        'datetime': 'DpSchemaType.Int64',
        'timestamp': 'DpSchemaType.Int64',
        'date': 'DpSchemaType.Int32',
        'time': 'DpSchemaType.Int32',
        'decimal': 'DpSchemaType.String',
        'numeric': 'DpSchemaType.String'
      };
      if (primitiveTypes[type]) return { type: primitiveTypes[type], typeName: toStandardTypeName(type) };
      const resolvedStr = this.getResolvedWireTypeString(type, ast, currentNamespace);
      if (primitiveTypes[resolvedStr]) return { type: primitiveTypes[resolvedStr], typeName: toStandardTypeName(resolvedStr) };
      const resolved = ast ? this.resolveTypeToASTDefinition(resolvedStr, currentNamespace, ast) : null;
      if (resolved?.kind === 'enum') return { type: 'DpSchemaType.Enum', typeName: type };
      if (resolved?.kind === 'record') {
        return {
          type: 'DpSchemaType.Struct',
          typeName: ast ? this.applyWireProfileSchemaTypeName(type, ast, currentNamespace) : type
        };
      }
      if (resolved?.kind === 'primitive') return { type: 'DpSchemaType.Int32', typeName: toStandardTypeName(type) };
      return { type: 'DpSchemaType.Struct', typeName: type };
    }
    if (typeof type === 'object' && type !== null) {
      if (type.type === 'list' || type.type === 'array') {
        const elemInfo = this.getSchemaTypeInfo(type.elementType, ast, currentNamespace);
        return { type: 'DpSchemaType.List', typeName: elemInfo.typeName };
      }
      if (type.type === 'set') {
        const elemInfo = this.getSchemaTypeInfo(type.elementType, ast, currentNamespace);
        return { type: 'DpSchemaType.Set', typeName: elemInfo.typeName };
      }
      if (type.type === 'map') {
        const keyInfo = this.getSchemaTypeInfo(type.keyType, ast, currentNamespace);
        const valueInfo = this.getSchemaTypeInfo(type.valueType, ast, currentNamespace);
        return { type: 'DpSchemaType.Map', typeName: `map<${keyInfo.typeName}, ${valueInfo.typeName}>` };
      }
    }
    return { type: 'DpSchemaType.Struct', typeName: 'object' };
  }
  
  /** C# expression for DpFieldSchema.DefaultValue (object) – full value for schema recovery. */
  private serializeDefaultValueToSchemaExpression(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return this.escapeCSharpString(value);
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) {
      const elements = value.map(v => `(object)(${this.serializeDefaultValueToSchemaExpression(v)})`).join(', ');
      return `new List<object> { ${elements} }`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => `{ ${this.escapeCSharpString(k)}, (object)(${this.serializeDefaultValueToSchemaExpression(v)}) }`).join(', ');
      return `new Dictionary<string, object> { ${entries} }`;
    }
    return 'null';
  }

  /**
   * message<> 첫 필드 기본값: struct.annotations.msgId + 첫 필드 타입의 AST만 사용.
   * 타입명/프로퍼티명 하드코딩 없음 — 첫 필드 struct에서 'result' 포함 필드·메시지 id용 필드 이름을 AST로 조회.
   */
  private buildMessageFirstFieldDefault(parentStruct: DeukPackStruct, field: DeukPackField, ast: DeukPackAST, currentNamespace: string): string | null {
    const msgId = parentStruct.annotations?.['msgId'];
    if (msgId == null || parentStruct.fields?.[0] !== field) return null;
    const typeStr = typeof field.type === 'string' ? field.type : '';
    if (!typeStr) return null;
    const msgInfoFull = this.resolveTypeToFullName(typeStr, currentNamespace, ast);
    const msgInfoStruct = this.findStruct(ast, typeStr, currentNamespace);
    if (!msgInfoStruct?.fields?.length) return null;
    const idField = msgInfoStruct.fields.find(f => /msgid|msg_id|messageid/i.test(f.name || ''));
    const resultField = msgInfoStruct.fields.find(f => (f.name || '').toLowerCase().includes('result'));
    if (!resultField) return null;
    const resultTypeStr = typeof resultField.type === 'string' ? resultField.type : ((resultField.type as { name?: string })?.name ?? '');
    if (!resultTypeStr) return null;
    const resultTypeFull = this.resolveTypeToFullName(resultTypeStr, this.getStructNamespace(msgInfoStruct, ast), ast);
    const resultPropName = this.capitalize(resultField.name);
    const idPropName = idField ? this.capitalize(idField.name) : 'MsgId'; // AST에 msgid 계열 필드 없을 때만 fallback
    return `new ${msgInfoFull}() { ${idPropName} = ${msgId}, ${resultPropName} = ${resultTypeFull}.CreateDefault() }`;
  }

  /** 필드 기본값의 C# 우변 식 반환 (인스턴스 초기화·Default_ 정적 프로퍼티 공용). enum/struct/primitive 공통. */
  private getFieldDefaultExpression(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string, parentStruct?: DeukPackStruct): string | null {
    if (parentStruct && ast && currentNamespace) {
      const msgDefault = this.buildMessageFirstFieldDefault(parentStruct, field, ast, currentNamespace);
      if (msgDefault != null) return msgDefault;
    }
    if (field.defaultValue === undefined) return null;
    const objInit = this.getCSharpStructObjectInitializer(field.defaultValue, field.type, currentNamespace, ast);
    if (objInit !== null) return objInit;
    const prim = this.getCSharpDefaultValue(field.defaultValue, field.type, ast, currentNamespace);
    return prim !== 'null' ? prim : null;
  }

  private generateField(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string, parentStruct?: DeukPackStruct): string[] {
    const lines: string[] = [];
    const fieldAttrs = field.csharpAttributes;
    if (fieldAttrs?.length) {
      for (const attr of fieldAttrs) {
        lines.push(`    ${attr}`);
      }
    }
    const efInfo = (this as any)._efCurrentRowInfo as { category: string; keyFieldNames: string[] } | null;
    const isEntityRow = !!efInfo && parentStruct?.declarationKind === 'entity';
    if (efInfo) {
      const keyFromTag = isEntityRow && this.fieldHasDeukBracketBase(field, 'key');
      if (efInfo.keyFieldNames.includes(field.name) || keyFromTag) {
        lines.push('    [Key]');
      }
      lines.push(`    [Column("${this.escapeCSharpStringContent(field.name)}")]`);
      if (isEntityRow) {
        const genOpts = (this as any)._genOptions as { efSupport?: boolean } | undefined;
        const propName = this.capitalize(field.name);
        if (genOpts?.efSupport && this.fieldHasDeukBracketBase(field, 'unique')) {
          lines.push(`    [Microsoft.EntityFrameworkCore.Index(nameof(${propName}), IsUnique = true)]`);
        } else if (genOpts?.efSupport && this.fieldHasDeukBracketBase(field, 'index')) {
          lines.push(`    [Microsoft.EntityFrameworkCore.Index(nameof(${propName}))]`);
        }
      }
    }
    const isRequired = field.required || (field.annotations && field.annotations['required'] === 'true');
    const isNullable = !isRequired;
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace, isNullable);
    const useRequired = (this as any)._csharpVersion === 'net8.0' && isRequired;
    const isRef = this.isCSharpReferenceType(field.type, ast, currentNamespace);
    
    let defaultPart = '';
    const defaultExpr = this.getFieldDefaultExpression(field, ast, currentNamespace, parentStruct);
    if (defaultExpr !== null) {
      defaultPart = ` = ${defaultExpr}`;
    } else if (isRef) {
      if (!isNullable) {
        if (field.type === 'string') defaultPart = ' = ""';
        else if (field.type === 'binary') defaultPart = ' = Array.Empty<byte>()';
        else if (ast && this.isStructType(field.type, ast, currentNamespace)) {
          const structType = this.getCSharpType(field.type, ast, currentNamespace, false);
          defaultPart = ` = new ${structType}()`;
        } else if (typeof field.type === 'object') {
          if (field.type.type === 'list' || field.type.type === 'array') defaultPart = ' = new()';
          else if (field.type.type === 'set') defaultPart = ' = new()';
          else if (field.type.type === 'map') defaultPart = ' = new()';
        }
      }
    }

    const modifier = useRequired ? "public required" : "public";
    lines.push(`    ${modifier} ${csharpType} ${this.capitalize(field.name)} { get; set; }${defaultPart}${defaultPart ? ';' : ''}`);
    
    return lines;
  }

  private isCSharpReferenceType(type: any, ast?: DeukPackAST, currentNamespace?: string): boolean {
    if (typeof type === 'string') {
      const primitives = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'float', 'double', 'datetime', 'timestamp', 'date', 'time', 'decimal', 'numeric'];
      if (primitives.includes(type)) return false;
      if (type === 'string' || type === 'binary') return true;
      
      // Check if it's an enum (value type) or struct (reference type)
      if (ast) {
        const fullName = this.resolveTypeToFullName(type, currentNamespace, ast);
        if (this.isEnumType(fullName, ast, currentNamespace)) return false;
        if (this.isStructType(fullName, ast, currentNamespace)) {
          if (this.isGeometryDeukStruct(type, ast, currentNamespace)) return false;
          return true;
        }
        // typedef to primitive (e.g., typedef int64 _linktid_xxx) → value type
        if (this.isPrimitiveType(type, ast, currentNamespace)) return false;
      }
      return true; // Assume reference type for unknown/structs
    }
    if (typeof type === 'object' && type.type) {
      const t = type.type;
      if (t === 'list' || t === 'array' || t === 'set' || t === 'map') return true;
      if (t === 'tablelink') return false; // tablelink maps to long (value type)
    }
    return true;
  }

  /** Struct의 풀네임 (namespace.shortName) */
  private getStructFullName(struct: DeukPackStruct, ast: DeukPackAST): string {
    const ns = this.getStructNamespace(struct, ast);
    const short = struct.name.includes('.') ? (struct.name.split('.').pop() ?? struct.name) : struct.name;
    return `${ns}.${short}`;
  }

  /** Enum의 풀네임 (namespace.shortName) */
  private getEnumFullName(enumDef: DeukPackEnum, ast: DeukPackAST): string {
    const ns = this.getEnumNamespace(enumDef, ast);
    const short = enumDef.name.includes('.') ? (enumDef.name.split('.').pop() ?? enumDef.name) : enumDef.name;
    return `${ns}.${short}`;
  }

  /** Typedef의 풀네임 (namespace.shortName) */
  private getTypedefFullName(typedef: DeukPackTypedef, ast: DeukPackAST): string {
    const ns = this.getTypedefNamespace(typedef, ast);
    const short = typedef.name.includes('.') ? (typedef.name.split('.').pop() ?? typedef.name) : typedef.name;
    return `${ns}.${short}`;
  }

  /** 타입 문자열을 풀네임으로 해석. AST의 struct/enum/typedef 기준으로만 매칭 (이름·점 휴리스틱 없음). */
  private resolveTypeToFullName(typeStr: string, currentNamespace: string | undefined, ast: DeukPackAST | undefined): string {
    if (!typeStr || typeof typeStr !== 'string') return typeStr;
    const primitives = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'float', 'double', 'string', 'binary', 'datetime', 'timestamp', 'date', 'time', 'decimal', 'numeric'];
    if (primitives.includes(typeStr)) return typeStr;
    if (!ast) return typeStr;
    if (typeStr.includes('.')) {
      for (const s of ast.structs ?? []) { if (this.getStructFullName(s, ast) === typeStr) return typeStr; }
      for (const e of ast.enums ?? []) { if (this.getEnumFullName(e, ast) === typeStr) return typeStr; }
      for (const t of ast.typedefs ?? []) { if (this.getTypedefFullName(t, ast) === typeStr) return typeStr; }
      return typeStr;
    }
    const sameNsFull = currentNamespace ? `${currentNamespace}.${typeStr}` : '';
    if (sameNsFull) {
      for (const s of ast.structs ?? []) {
        if (this.getStructFullName(s, ast) === sameNsFull) return sameNsFull;
      }
      for (const e of ast.enums ?? []) {
        if (this.getEnumFullName(e, ast) === sameNsFull) return sameNsFull;
      }
      for (const t of ast.typedefs ?? []) {
        if (this.getTypedefFullName(t, ast) === sameNsFull) return sameNsFull;
      }
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
    if (currentNamespace && matches.some(m => m.startsWith(currentNamespace + '.'))) {
      return matches.find(m => m.startsWith(currentNamespace + '.')) ?? matches[0] ?? typeStr;
    }
    return matches[0] ?? typeStr;
  }

  /**
   * AST 기준 타입 판별: 휴리스틱 없이 struct/enum/typedef 조회만 사용.
   * AST에 정의되지 않은 타입(typedef/struct/enum에 없음) → primitive 로 간주.
   * @returns 'primitive' | { kind: 'record', def } | { kind: 'enum', def } | null (미정의 타입, 득팩 표준 record)
   */
  private resolveTypeToASTDefinition(type: any, currentNamespace: string | undefined, ast: DeukPackAST | undefined, visitedTypedefs: Set<string> = new Set()): { kind: 'primitive' } | { kind: 'record'; def: DeukPackStruct } | { kind: 'enum'; def: DeukPackEnum } | null {
    if (!ast) return null;
    if (typeof type === 'object' && type !== null && 'type' in type) {
      if (type.type === 'list' || type.type === 'array' || type.type === 'set' || type.type === 'map') return null;
    }
    if (typeof type !== 'string') return null;
    const fullName = this.resolveTypeToFullName(type, currentNamespace, ast);
    if (ast.typedefs && ast.typedefs.length > 0) {
      for (const typedef of ast.typedefs) {
        if (this.getTypedefFullName(typedef, ast) !== fullName) continue;
        if (visitedTypedefs.has(fullName)) return null;
        visitedTypedefs.add(fullName);
        const inner = typeof typedef.type === 'string'
          ? this.resolveTypeToASTDefinition(typedef.type, currentNamespace, ast, visitedTypedefs)
          : null;
        visitedTypedefs.delete(fullName);
        return inner;
      }
    }
    for (const s of ast.structs ?? []) {
      if (this.getStructFullName(s, ast) === fullName) return { kind: 'record', def: s };
    }
    for (const e of ast.enums ?? []) {
      if (this.getEnumFullName(e, ast) === fullName) return { kind: 'enum', def: e };
    }
    // AST에 정의되지 않은 타입 = 원시 타입 (휴리스틱 없음)
    return { kind: 'primitive' };
  }

  /**
   * Apache 호환: default 있는 struct 필드 할당 후, 그 내부의 default 있는 nested struct가 null이면 CreateDefault()로 채움.
   * (기본값이 있는 중첩 필드는 AST 기준으로만 처리, 타입명 하드코딩 없음)
   */
  private generateEnsureNestedDefaults(parentFieldName: string, fieldType: string, ast: DeukPackAST, currentNamespace?: string): string[] {
    const target = this.findStruct(ast, fieldType, currentNamespace);
    if (!target || !target.fields) return [];
    const targetNs = this.getStructNamespace(target, ast);
    const out: string[] = [];
    for (const nested of target.fields) {
      if (nested.defaultValue === undefined) continue;
      const nestedCSharpType = this.getCSharpType(nested.type, ast, targetNs);
      const isNestedStruct = typeof nested.type === 'string' && (
        this.isStructType(nested.type, ast, targetNs) ||
        this.isStructCSharpType(nestedCSharpType, ast)
      );
      if (!isNestedStruct) continue;
      if (typeof nested.type === 'string' && this.isGeometryDeukStruct(nested.type, ast, targetNs)) continue;
      const nestedFieldName = this.capitalize(nested.name);
      out.push(`if (this.${parentFieldName} != null && this.${parentFieldName}.${nestedFieldName} == null) this.${parentFieldName}.${nestedFieldName} = ${nestedCSharpType}.CreateDefault();`);
    }
    return out;
  }

  /** AST에서 풀네임으로만 struct 정의 찾기. typedef이면 대상 타입으로 따라감. */
  private findStruct(ast: DeukPackAST | undefined, typeName: string, currentNamespace?: string): DeukPackStruct | null {
    if (!ast || !ast.structs || typeof typeName !== 'string') return null;
    const fullName = this.resolveTypeToFullName(typeName, currentNamespace, ast);
    for (const s of ast.structs) {
      if (this.getStructFullName(s, ast) === fullName) return s;
    }
    let typedef = this.findTypedef(ast, typeName, currentNamespace);
    if (!typedef && typeName.includes('.')) {
      const shortName = typeName.split('.').pop() ?? typeName;
      typedef = this.findTypedef(ast, shortName, currentNamespace);
    }
    if (!typedef && ast.typedefs?.length) {
      const shortName = typeName.includes('.') ? (typeName.split('.').pop() ?? typeName) : typeName;
      for (const t of ast.typedefs) {
        const tShort = t.name.includes('.') ? (t.name.split('.').pop() ?? t.name) : t.name;
        if (tShort === shortName && typeof t.type === 'string') {
          typedef = t;
          break;
        }
      }
    }
    if (typedef && typeof typedef.type === 'string') return this.findStruct(ast, typedef.type, currentNamespace);
    return null;
  }

  /** AST에서 풀네임 또는 short name( currentNamespace 있을 때)으로 typedef 정의 찾기 */
  private findTypedef(ast: DeukPackAST | undefined, typeName: string, currentNamespace?: string): DeukPackTypedef | null {
    if (!ast?.typedefs || typeof typeName !== 'string') return null;
    const fullName = this.resolveTypeToFullName(typeName, currentNamespace, ast);
    for (const t of ast.typedefs) {
      if (this.getTypedefFullName(t, ast) === fullName) return t;
    }
    return null;
  }

  /**
   * Struct 필드 기본값 객체 → C# 객체 초기화.
   * Apache 호환: 특정 필드만 지정해도, 지정되지 않은 하위 struct 멤버는 CreateDefault()로 할당.
   * 구조체·enum·변수 참조는 항상 풀네임으로 생성.
   */
  private getCSharpStructObjectInitializer(defaultValue: any, fieldType: any, currentNamespace?: string, ast?: DeukPackAST): string | null {
    if (typeof defaultValue !== 'object' || defaultValue === null || Array.isArray(defaultValue)) {
      return null;
    }
    const keys = Object.keys(defaultValue);
    const typeName = typeof fieldType === 'string' ? fieldType : '';
    const typeFullName = ast ? this.resolveTypeToFullName(typeName, currentNamespace, ast) : typeName;
    const csharpType = this.getCSharpType(fieldType, ast, currentNamespace);
    let targetStruct = this.findStruct(ast, typeFullName, currentNamespace);
    if (!targetStruct && typeName && ast?.typedefs?.length) {
      const shortName = typeFullName.includes('.') ? typeFullName.split('.').pop()! : typeFullName;
      for (const t of ast.typedefs) {
        const tShort = t.name.includes('.') ? (t.name.split('.').pop() ?? t.name) : t.name;
        if (tShort === shortName && typeof t.type === 'string') {
          targetStruct = this.findStruct(ast, t.type, currentNamespace);
          break;
        }
      }
    }
    if (!targetStruct && typeName) {
      throw new Error(`[CSharpGenerator] Struct not found for default value object: ${typeFullName}`);
    }
    if (keys.length === 0 && targetStruct && targetStruct.annotations?.['geometry']) {
      return `default(${csharpType})`;
    }
    const assignments: string[] = [];
    const assignedByPush = new Set<string>();
    for (const key of keys) {
      const val = defaultValue[key];
      const propName = this.capitalize(key);
      const member = targetStruct?.fields?.find(f => f.name.toLowerCase() === key.toLowerCase());
      if (!member && val !== null && val !== undefined) {
        throw new Error(`[CSharpGenerator] Field '${key}' not found in struct ${csharpType} (default value)`);
      }
      const memberType = member?.type;
      const memberTypeFull = (typeof memberType === 'string' && ast) ? this.resolveTypeToFullName(memberType, currentNamespace, ast) : memberType;
      const rhs = this.getCSharpDefaultValueForStructMember(val, memberTypeFull, currentNamespace, ast, csharpType, key);
      if (rhs !== null) {
        assignments.push(`${propName} = ${rhs}`);
        assignedByPush.add(key.toLowerCase());
      }
    }
    if (targetStruct && ast) {
      for (const member of targetStruct.fields) {
        if (assignedByPush.has(member.name.toLowerCase())) continue;
        if (typeof member.type !== 'string' || this.isEnumType(member.type, ast, currentNamespace)) continue;
        const isNestedStruct =
          this.isStructType(member.type, ast, currentNamespace) ||
          this.isStructCSharpType(this.getCSharpType(member.type, ast, currentNamespace), ast);
        if (!isNestedStruct) continue;
        const nestedType = this.getCSharpType(member.type, ast, currentNamespace);
        if (this.isGeometryDeukStruct(member.type, ast, currentNamespace)) {
          assignments.push(`${this.capitalize(member.name)} = default(${nestedType})`);
          continue;
        }
        assignments.push(`${this.capitalize(member.name)} = ${nestedType}.CreateDefault()`);
      }
    }
    if (assignments.length === 0) return null;
    return `new ${csharpType}() { ${assignments.join(', ')} }`;
  }

  /**
   * Struct 멤버 기본값 → C# 우변 식.
   * enum/구조체/변수 참조는 항상 풀네임으로 생성. 필드 타입(풀네임)만 보고 분기.
   */
  private getCSharpDefaultValueForStructMember(val: any, memberType: any, currentNamespace?: string, ast?: DeukPackAST, structName?: string, fieldName?: string): string | null {
    if (val === null || val === undefined) return null;
    const typeStr = typeof memberType === 'string' ? memberType : undefined;
    if (typeStr === undefined) {
      throw new Error(`[CSharpGenerator] Member type required for default value (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}). No fallback.`);
    }
    // 모든 타입 참조를 풀네임으로 통일 (구조체·enum 동일)
    const typeFull = ast ? this.resolveTypeToFullName(typeStr, currentNamespace, ast) : typeStr;
    const resolvedCSharpType = this.getCSharpType(memberType, ast, currentNamespace);
    const isEnum = ast && this.isEnumTypeFullName(typeFull, ast, currentNamespace);
    const isStruct = ast && this.isStructTypeFullName(typeFull, ast, currentNamespace);
    const isNumeric = ['int', 'short', 'long', 'byte'].includes(resolvedCSharpType);

    const quote = (s: string) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    switch (typeof val) {
      case 'number':
        if (isEnum) {
          throw new Error(`[CSharpGenerator] Enum field '${fieldName}' does not accept numeric default (struct: ${structName ?? '?'}).`);
        }
        if (resolvedCSharpType === 'bool') return val ? 'true' : 'false';
        if (resolvedCSharpType === 'long' || typeStr === 'int64') return `${val}L`;
        return `${val}`;

      case 'boolean':
        if (isNumeric) return val ? '1' : '0';
        return val ? 'true' : 'false';

      case 'object':
        if (Array.isArray(val)) return null;
        if (!isStruct) {
          throw new Error(`[CSharpGenerator] Object default value for non-struct type '${typeFull}' (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}).`);
        }
        const nestedNs = typeFull.includes('.') ? typeFull.split('.').slice(0, -1).join('.') : currentNamespace;
        const nested = this.getCSharpStructObjectInitializer(val, typeFull, nestedNs ?? currentNamespace, ast);
        const csharpTypeName = this.getCSharpType(memberType, ast, currentNamespace);
        if (nested == null && ast && this.isGeometryDeukStruct(memberType, ast, currentNamespace)) {
          return `default(${csharpTypeName})`;
        }
        return nested ?? `${csharpTypeName}.CreateDefault()`;

      case 'string': {
        const hasDot = val.includes('.') && val.split('.').length >= 2;
        const valuePart = hasDot ? (val.split('.').pop() ?? val) : '';
        // C# 생성물에 원시 타입명(i32 등)이 나오면 안 됨. 숫자 필드 enum 기본값은 항상 enum 풀네임으로 생성
        const isPrimitive = ast && this.isPrimitiveSchemaType(typeFull, ast, currentNamespace);
        let fullEnumExpr: string;
        if (hasDot) {
          if (isPrimitive && ast) {
            const enumFull = this.findEnumFullNameByValueName(ast, valuePart, currentNamespace);
            if (!enumFull) throw new Error(`[CSharpGenerator] Cannot emit primitive in C#; no enum found for value '${valuePart}'. Struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}.`);
            fullEnumExpr = `${enumFull}.${valuePart}`;
          } else {
            fullEnumExpr = `${typeFull}.${valuePart}`;
          }
        } else {
          fullEnumExpr = currentNamespace && val.split('.').length === 2 ? `${currentNamespace}.${val}` : val;
        }

        if (resolvedCSharpType === 'string') return quote(val);
        if (resolvedCSharpType === 'bool' && (val === 'true' || val === 'false')) return val;

        if (hasDot) {
          if (isEnum) {
            const enumDef = this.findEnumByFullName(ast ?? undefined, typeFull, currentNamespace);
            if (!enumDef || !Object.prototype.hasOwnProperty.call(enumDef.values, valuePart)) {
              throw new Error(`[CSharpGenerator] Enum '${typeFull}' has no value '${valuePart}' (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}).`);
            }
            return fullEnumExpr;
          }
          if (isNumeric) {
            if (!fullEnumExpr.includes('.')) {
              throw new Error(`[CSharpGenerator] Numeric field '${fieldName}' requires full enum reference (e.g. namespace.id_e.xxx), got: '${val}' (struct: ${structName ?? '?'}).`);
            }
            return `(int)${fullEnumExpr}`;
          }
          throw new Error(`[CSharpGenerator] Enum literal '${val}' but field type '${typeFull}' is not enum or numeric (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}).`);
        }

        if (isEnum) {
          throw new Error(`[CSharpGenerator] Enum field '${fieldName}' requires enum literal (e.g. id_e.xxx), got: '${val}' (struct: ${structName ?? '?'}).`);
        }
        if (isNumeric) return quote(val);
        throw new Error(`[CSharpGenerator] String default value for type '${typeFull}' not supported (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}).`);
      }

      default:
        throw new Error(`[CSharpGenerator] Unsupported default value type for '${typeFull}' (struct: ${structName ?? '?'}, field: ${fieldName ?? '?'}).`);
    }
  }

  /** 레거시 Thrift typedef i64 _link_* / _linktid_* 타입명 여부 (AST에 typedef 없을 때 long 처리용). */
  private isLinkTypedefName(typeName: string): boolean {
    return typeof typeName === 'string' && (typeName.startsWith('_link_') || typeName.startsWith('_linktid_'));
  }

  /** wireProfilesEmit: struct 풀네임이 현재 프로파일 서브셋에 있으면 C# 타입명에 프로파일 접미사를 붙인다. */
  private renameCSharpTypeIfWireProfileSubset(fullName: string): string {
    const suffix = (this as any)._wireProfileStructSuffix as string | undefined;
    const set = (this as any)._wireProfileSubsetFullNames as Set<string> | undefined;
    if (!suffix || !set || !fullName) return fullName;
    if (!set.has(fullName)) return fullName;
    const idx = fullName.lastIndexOf('.');
    const ns = idx >= 0 ? fullName.slice(0, idx) : '';
    const short = idx >= 0 ? fullName.slice(idx + 1) : fullName;
    const renamed = short + suffix;
    return ns ? `${ns}.${renamed}` : renamed;
  }

  /** GetSchema TypeName: 중첩 struct가 같은 프로파일에 서브셋이 있으면 동일 접미사를 사용한다. */
  private applyWireProfileSchemaTypeName(idlTypeStr: string, ast: DeukPackAST, currentNamespace?: string): string {
    const suffix = (this as any)._wireProfileStructSuffix as string | undefined;
    const set = (this as any)._wireProfileSubsetFullNames as Set<string> | undefined;
    if (!suffix || !set) return idlTypeStr;
    const full = this.resolveTypeToFullName(idlTypeStr, currentNamespace, ast);
    if (!set.has(full)) return idlTypeStr;
    const short = full.includes('.') ? full.slice(full.lastIndexOf('.') + 1) : full;
    return short + suffix;
  }

  /**
   * Per-source-file C# 출력이 `namespace currentNs { ... }`로 감싸일 때,
   * `other_ns.Type`은 C#에서 `currentNs.other_ns`로 해석될 수 있음 → `global::other_ns.Type` 필요.
   * 같은 네임스페이스면 `currentNs.Type`은 C#에서 정상(외부 네임스페이스 한정자)으로 유지.
   */
  private csharpGlobalQualifiedIfCrossNamespace(dottedType: string, currentNamespace?: string): string {
    if (!dottedType || !dottedType.includes('.')) return dottedType;
    const lastDot = dottedType.lastIndexOf('.');
    const typeNs = dottedType.slice(0, lastDot);
    if (!currentNamespace || typeNs === currentNamespace) return dottedType;
    return `global::${dottedType}`;
  }

  /** currentNamespace 지정 시 다른 네임스페이스 타입은 풀네임으로 반환. AST 조회만 사용(휴리스틱 없음). */
  private getCSharpType(type: any, ast?: DeukPackAST, currentNamespace?: string, isNullable: boolean = false): string {
    const enableNullable = (this as any)._csharpNullable === true;
    const suffix = (enableNullable && isNullable) ? "?" : "";

    if (typeof type === 'string') {
      switch (type) {
        case 'bool': return 'bool';
        case 'byte': return 'byte';
        case 'int8': return 'sbyte';
        case 'int16': return 'short';
        case 'int32': return 'int';
        case 'int64': return 'long';
        case 'uint8': return 'byte';
        case 'uint16': return 'ushort';
        case 'uint32': return 'uint';
        case 'uint64': return 'ulong';
        case 'float': return 'float';
        case 'double': return 'double';
        case 'string': return 'string' + suffix;
        case 'binary': return 'byte[]' + suffix;
        case 'datetime':
        case 'timestamp':
        case 'date': return 'DateTime';
        case 'time': return 'TimeSpan';
        case 'decimal':
        case 'numeric': return 'decimal';
        case 'dynamic': return 'object' + suffix;
        default: {
          const primitives = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'double', 'string', 'binary', 'datetime', 'timestamp', 'date', 'time', 'decimal', 'numeric'];
          const typedefDef = ast ? this.findTypedef(ast, type, currentNamespace) : null;
          if (typedefDef) return this.getCSharpType(typedefDef.type, ast, currentNamespace, isNullable);
          if (this.isLinkTypedefName(type)) return 'long';
          const fullName = ast ? this.resolveTypeToFullName(type, currentNamespace, ast) : type;
          if (primitives.includes(fullName)) {
            return this.getCSharpType(fullName, ast, currentNamespace, isNullable);
          }
          const named = ast ? this.renameCSharpTypeIfWireProfileSubset(fullName) : fullName;
          return this.csharpGlobalQualifiedIfCrossNamespace(named, currentNamespace) + suffix;
        }
      }
    }
    if (typeof type === 'object' && type.type) {
      switch (type.type) {
        case 'list':
        case 'array':
          return `List<${this.getCSharpType(type.elementType, ast, currentNamespace)}>` + suffix;
        case 'set':
          return `HashSet<${this.getCSharpType(type.elementType, ast, currentNamespace)}>` + suffix;
        case 'map':
          return `Dictionary<${this.getCSharpType(type.keyType, ast, currentNamespace)}, ${this.getCSharpType(type.valueType, ast, currentNamespace)}>` + suffix;
        case 'tablelink':
          return 'long';
        default:
          return 'object' + suffix;
      }
    }
    return 'object' + suffix;
  }

  private getCSharpDefaultValue(value: any, type: any, ast?: DeukPackAST, currentNamespace?: string): string {
    // 숫자 값이 list/set/map 타입에 할당된 경우 (잘못된 IDL 정의)
    if (typeof value === 'number' && typeof type === 'object' && type !== null && type.type) {
      switch (type.type) {
        case 'list':
          const listElemType = this.getCSharpType(type.elementType, ast, currentNamespace);
          return `new List<${listElemType}>()`;
        case 'set':
          const setElemType = this.getCSharpType(type.elementType, ast, currentNamespace);
          return `new HashSet<${setElemType}>()`;
        case 'map':
          const keyType = this.getCSharpType(type.keyType, ast, currentNamespace);
          const valueType = this.getCSharpType(type.valueType, ast, currentNamespace);
          return `new Dictionary<${keyType}, ${valueType}>()`;
      }
    }
    
    if (typeof value === 'string') {
        // enum 값인지 확인 (예: community_type_e.None, mo_define.level_exp_type_e.None)
        if (value.includes('.')) {
          const parts = value.split('.');
          const possibleEnumName = parts.length >= 2 ? parts.slice(0, -1).join('.') : '';
          const valuePart: string = parts.length >= 2 ? (parts[parts.length - 1] ?? '') : '';
          if (parts.length >= 2) {

            // AST에서 enum 찾기 → 항상 풀네임으로 출력
            if (ast && this.isEnumType(possibleEnumName, ast, currentNamespace)) {
              const enumDef = this.findEnumByFullName(ast, possibleEnumName, currentNamespace);
              if (enumDef) return `${this.getEnumFullName(enumDef, ast)}.${valuePart}`;
              return value;
            }
            // 접두어가 원시 타입(i32 등)이면 C# 생성물에 나오면 안 됨 → 값 이름으로 enum 풀네임 조회 후 반환
            if (ast && valuePart && this.isPrimitiveSchemaType(possibleEnumName, ast, currentNamespace)) {
              const enumFull = this.findEnumFullNameByValueName(ast, valuePart, currentNamespace);
              if (enumFull) return `${enumFull}.${valuePart}`;
            }
          }
          
          // version.app_version 같은 상수 참조인지 확인
          if (ast) {
            const resolved = this.resolveConstant(value, ast);
            if (resolved !== null) {
              return String(resolved);
            }
          }
          // 접두어가 타입(enum/struct)이면 풀네임으로 해석 후 반환
          if (ast && possibleEnumName && valuePart) {
            const prefixFull = this.resolveTypeToFullName(possibleEnumName, currentNamespace, ast);
            if (prefixFull && prefixFull !== possibleEnumName) return `${prefixFull}.${valuePart}`;
          }
          return value;
        }

        // type이 Enum인 경우, 단일 식별자 값(예: Beta)을 해당 Enum 멤버로 처리
        if (typeof type === 'string' && ast) {
          const typeFull = this.resolveTypeToFullName(type, currentNamespace, ast);
          const enumDef = this.findEnumByFullName(ast, typeFull, currentNamespace);
          if (enumDef && Object.prototype.hasOwnProperty.call(enumDef.values, value)) {
            return `${this.getEnumFullName(enumDef, ast)}.${value}`;
          }
        }
      // Check if it's a boolean string
      if (value === 'true' || value === 'false') {
        return value;
      }
      return `"${value}"`;
    }
    if (typeof value === 'number') {
      const csharpType = this.getCSharpType(type, ast, currentNamespace);
      if (csharpType === 'float') return `${value}f`;
      if (csharpType === 'long' || csharpType === 'ulong') return `${value}L`;
      if (csharpType === 'decimal') return `${value}m`;
      return value.toString();
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    // null, undefined 또는 타입만 있고 값이 없는 경우
    if (value === null || value === undefined || typeof value === 'object') {
      // {} 등 빈 객체 + struct 타입: 하위 모든 구조체가 할당되도록 CreateDefault() 사용
      if (typeof type === 'string' && ast && this.isStructType(type, ast, currentNamespace)) {
        const csharpType = this.getCSharpType(type, ast, currentNamespace);
        if (this.isGeometryDeukStruct(type, ast, currentNamespace)) {
          return `default(${csharpType})`;
        }
        return `${csharpType}.CreateDefault()`;
      }
      // 타입에 따른 기본값 설정
      if (typeof type === 'object' && type !== null && type.type) {
        switch (type.type) {
          case 'list':
          case 'array':
            const listElemType2 = this.getCSharpType(type.elementType, ast, currentNamespace);
            return `new List<${listElemType2}>()`;
          case 'set':
            const setElemType2 = this.getCSharpType(type.elementType, ast, currentNamespace);
            return `new HashSet<${setElemType2}>()`;
          case 'map':
            const keyType2 = this.getCSharpType(type.keyType, ast, currentNamespace);
            const valueType2 = this.getCSharpType(type.valueType, ast, currentNamespace);
            return `new Dictionary<${keyType2}, ${valueType2}>()`;
          case 'tablelink':
            return '0L';
          default:
            return 'null';
        }
      }
      if (typeof type === 'string') {
        switch (type) {
          case 'bool': return 'false';
          case 'byte':
          case 'int8':
          case 'int16':
          case 'int32':
          case 'int64':
          case 'float':
          case 'double': return type === 'int64' ? '0L' : '0';
          case 'string': return '""';
          case 'datetime':
          case 'timestamp':
          case 'date': return 'default(DateTime)';
          case 'time': return 'default(TimeSpan)';
          case 'decimal':
          case 'numeric': return '0m';
          default:
            // enum이면 첫 번째 값 또는 기본값 (AST 조회)
            const enumResolved = ast ? this.resolveTypeToASTDefinition(type, currentNamespace, ast) : null;
            if (enumResolved?.kind === 'enum' && ast && enumResolved.def.values && typeof enumResolved.def.values === 'object') {
              const entries = Object.entries(enumResolved.def.values);
              const firstEntry = entries[0];
              if (firstEntry) {
                const enumFullName = this.getEnumFullName(enumResolved.def, ast);
                return `${enumFullName}.${firstEntry[0]}`;
              }
            }
            return 'null';
        }
      }
      return 'null';
    }
    return 'null';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /** typedef를 따라 최종 wire 타입 문자열 반환 (타입 매칭용). 객체(list/set/map)는 그대로 두고 getTType에서 처리. */
  private getResolvedWireTypeString(type: any, ast?: DeukPackAST, currentNamespace?: string): string {
    if (typeof type !== 'string') return typeof type === 'object' && type?.type ? type.type : 'record';
    const typedefDef = ast ? this.findTypedef(ast, type, currentNamespace) : null;
    if (typedefDef) {
      const inner = typedefDef.type;
      if (typeof inner === 'string') return this.getResolvedWireTypeString(inner, ast, currentNamespace);
    }
    if (this.isLinkTypedefName(type)) return 'int64';
    return type;
  }

  /** Wire type: enum→Int32, typedef→해당 primitive/enum/struct/list/set/map, 그 외 custom→Struct. */
  private getTType(type: any, ast?: DeukPackAST, currentNamespace?: string): string {
    if (typeof type === 'string') {
      const typedefDef = ast ? this.findTypedef(ast, type, currentNamespace) : null;
      if (typedefDef && typeof typedefDef.type !== 'string') return this.getTType(typedefDef.type, ast, currentNamespace);
      const resolved = ast ? this.getResolvedWireTypeString(type, ast, currentNamespace) : type;
      switch (resolved) {
        case 'bool': return 'DpWireType.Bool';
        case 'byte': return 'DpWireType.Byte';
        case 'int8': return 'DpWireType.Byte';
        case 'int16': return 'DpWireType.Int16';
        case 'int32': return 'DpWireType.Int32';
        case 'int64': return 'DpWireType.Int64';
        case 'uint8': return 'DpWireType.U8';
        case 'uint16': return 'DpWireType.U16';
        case 'uint32': return 'DpWireType.U32';
        case 'uint64': return 'DpWireType.U64';
        case 'float':
        case 'double': return 'DpWireType.Double';
        case 'string': return 'DpWireType.String';
        case 'binary': return 'DpWireType.String';
        case 'datetime':
        case 'timestamp': return 'DpWireType.Int64';
        case 'date':
        case 'time': return 'DpWireType.Int32';
        case 'decimal':
        case 'numeric': return 'DpWireType.String';
        default:
          if (this.isLinkTypedefName(resolved)) return 'DpWireType.Int64';
          if (ast && this.resolveTypeToASTDefinition(resolved, currentNamespace, ast)?.kind === 'enum') return 'DpWireType.Int32';
          return 'DpWireType.Struct';
      }
    }
    
    if (typeof type === 'object' && type.type) {
      switch (type.type) {
        case 'list':
        case 'array':
          return 'DpWireType.List';
        case 'set': return 'DpWireType.Set';
        case 'map': return 'DpWireType.Map';
        case 'tablelink': return 'DpWireType.Int64';
        default: return 'DpWireType.Struct';
      }
    }
    
    return 'DpWireType.Struct';
  }

  private generateReadField(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string): string {
    const fieldName = this.capitalize(field.name);
    const tType = this.getTType(field.type, ast, currentNamespace);
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace);
    
    if (typeof field.type === 'string') {
      switch (field.type) {
        case 'bool': return `this.${fieldName} = (bool)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(bool))!;`;
        case 'byte': return `this.${fieldName} = (byte)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(byte))!;`;
        case 'int8': return `this.${fieldName} = (sbyte)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(sbyte))!;`;
        case 'int16': return `this.${fieldName} = (short)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(short))!;`;
        case 'int32': return `this.${fieldName} = (int)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(int))!;`;
        case 'int64': return `this.${fieldName} = (long)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(long))!;`;
        case 'uint8': return `this.${fieldName} = (byte)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(byte))!;`;
        case 'uint16': return `this.${fieldName} = (ushort)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(ushort))!;`;
        case 'uint32': return `this.${fieldName} = (uint)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(uint))!;`;
        case 'uint64': return `this.${fieldName} = (ulong)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(ulong))!;`;
        case 'float': return `this.${fieldName} = (float)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(float))!;`;
        case 'double': return `this.${fieldName} = (double)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(double))!;`;
        case 'string': return `this.${fieldName} = (string)DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(string))!;`;
        case 'binary': return `this.${fieldName} = (byte[])DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(byte[]))!;`;
        case 'datetime':
        case 'timestamp': return `this.${fieldName} = new DateTime((long)DeukPackSerializer.ReadValue(iprot, DpWireType.Int64, typeof(long))!, DateTimeKind.Utc);`;
        case 'date': {
          const v = `(int)DeukPackSerializer.ReadValue(iprot, DpWireType.Int32, typeof(int))!`;
          return `var _${fieldName} = ${v}; this.${fieldName} = _${fieldName} == 0 ? default(DateTime) : new DateTime(_${fieldName} / 10000, (_${fieldName} / 100) % 100, _${fieldName} % 100);`;
        }
        case 'time': return `this.${fieldName} = TimeSpan.FromMilliseconds((int)DeukPackSerializer.ReadValue(iprot, DpWireType.Int32, typeof(int))!);`;
        case 'decimal':
        case 'numeric': return `var _${fieldName}Str = (string)DeukPackSerializer.ReadValue(iprot, DpWireType.String, typeof(string))!; this.${fieldName} = string.IsNullOrEmpty(_${fieldName}Str) ? 0m : decimal.Parse(_${fieldName}Str, System.Globalization.CultureInfo.InvariantCulture);`;
        default: {
          const readExpr = `(${csharpType})DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType}))!`;
          const isStruct = ast && (this.isStructType(field.type, ast, currentNamespace) || this.isStructCSharpType(csharpType, ast));
          if (ast && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
            return `{ var _r = DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType})); this.${fieldName} = _r == null ? default(${csharpType}) : (${csharpType})_r; }`;
          }
          return isStruct ? `this.${fieldName} = ${readExpr} ?? ${csharpType}.CreateDefault();` : `this.${fieldName} = ${readExpr};`;
        }
      }
    }
    
    if (typeof field.type === 'object' && 'type' in field.type) {
      switch (field.type.type) {
        case 'list':
        case 'array':
          return this.generateReadList(field, ast, currentNamespace);
        case 'set': return this.generateReadSet(field, ast, currentNamespace);
        case 'map': return this.generateReadMap(field, ast, currentNamespace);
        default: {
          const readExpr = `(${csharpType})DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType}))!`;
          const isStruct = ast && this.isStructCSharpType(csharpType, ast);
          if (ast && typeof field.type === 'string' && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
            return `{ var _r = DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType})); this.${fieldName} = _r == null ? default(${csharpType}) : (${csharpType})_r; }`;
          }
          return isStruct ? `this.${fieldName} = ${readExpr} ?? ${csharpType}.CreateDefault();` : `this.${fieldName} = ${readExpr};`;
        }
      }
    }
    
    const readExpr = `(${csharpType})DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType}))!`;
    const isStruct = ast && (this.isStructType(field.type, ast, currentNamespace) || this.isStructCSharpType(csharpType, ast));
    if (ast && typeof field.type === 'string' && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
      return `{ var _r = DeukPackSerializer.ReadValue(iprot, ${tType}, typeof(${csharpType})); this.${fieldName} = _r == null ? default(${csharpType}) : (${csharpType})_r; }`;
    }
    return isStruct ? `this.${fieldName} = ${readExpr} ?? ${csharpType}.CreateDefault();` : `this.${fieldName} = ${readExpr};`;
  }

  /**
   * Unified Write(oprot, fieldIds, overrides): all fields, projection, and overrides in one path.
   */
  private generateWriteUnifiedInner(struct: DeukPackStruct, ast: DeukPackAST, ns: string, wireName: string): string {
    const wn = this.escapeCSharpStringContent(wireName);
    const lines: string[] = [];
    lines.push('      if (fieldIds != null && fieldIds.Count == 0) return;');
    lines.push(`      DpRecord struc = new DpRecord("${wn}", ${struct.fields.length});`);
    lines.push('      oprot.WriteStructBegin(struc);');

    for (const field of struct.fields) {
      const fieldName = this.capitalize(field.name);
      const csharpType = this.getCSharpType(field.type, ast, ns);
      const tType = this.getTType(field.type, ast, ns);
      const id = field.id;

      lines.push(`      // field ${id}: ${field.name}`);
      lines.push(`      if (fieldIds == null || fieldIds.Contains(${id}))`);
      lines.push('      {');
      lines.push(
        `        var _v${id} = (overrides != null && overrides.TryGetValue(${id}, out var _o${id})) ? (${csharpType})_o${id} : this.${fieldName};`
      );
      const condExpr = this.generateWriteConditionForVar(`_v${id}`, field, ast, ns);
      lines.push(`        ${condExpr}`);
      lines.push('        {');
      lines.push(`          DpColumn field = new DpColumn("${this.escapeCSharpStringContent(field.name)}", ${tType}, ${id});`);
      lines.push('          oprot.WriteFieldBegin(field);');
      lines.push('          ' + this.generateWriteExpressionForVar(`_v${id}`, field, ast, ns));
      lines.push('          oprot.WriteFieldEnd();');
      lines.push('        }');
      lines.push('      }');
    }

    lines.push('      oprot.WriteFieldStop();');
    lines.push('      oprot.WriteStructEnd();');
    return lines.join('\n');
  }

  /** generateWriteCondition과 동일 로직이지만, this.X 대신 임의 변수명을 사용한다. */
  private generateWriteConditionForVar(
    varName: string,
    field: DeukPackField,
    ast?: DeukPackAST,
    currentNamespace?: string,
    resolveDepth = 0
  ): string {
    const explicitDefaultExpr = field.defaultValue !== undefined && ast
      ? this.getCSharpDefaultValue(field.defaultValue, field.type, ast, currentNamespace)
      : null;

    if (typeof field.type === 'object' && field.type !== null && (field.type as any).type === 'tablelink') {
      return `if (${varName} != 0L)`;
    }

    if (typeof field.type === 'string' && ast != null && currentNamespace != null && resolveDepth < 24) {
      const resolvedWire = this.getResolvedWireTypeString(field.type, ast, currentNamespace);
      if (resolvedWire && resolvedWire !== field.type) {
        return this.generateWriteConditionForVar(varName, { ...field, type: resolvedWire as DeukPackType }, ast, currentNamespace, resolveDepth + 1);
      }
    }

    if (typeof field.type === 'string') {
      const ts = field.type as string;
      const primitiveTypes = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'i8', 'i16', 'i32', 'i64', 'float', 'double'];
      if (primitiveTypes.includes(ts)) {
        if (explicitDefaultExpr !== null && explicitDefaultExpr !== 'null') {
          const longSuffix =
            ((ts === 'int64' || ts === 'i64') && /^\d+$/.test(explicitDefaultExpr)) ? 'L' :
            (ts === 'uint64' && /^\d+$/.test(explicitDefaultExpr)) ? 'UL' :
            (ts === 'uint32' && /^\d+$/.test(explicitDefaultExpr)) ? 'u' : '';
          return `if (${varName} != ${explicitDefaultExpr}${longSuffix})`;
        }
        switch (ts) {
          case 'bool': return `if (${varName})`;
          case 'byte': case 'int8': case 'i8': case 'int16': case 'i16': case 'int32': case 'i32': case 'uint8': case 'uint16': return `if (${varName} != 0)`;
          case 'uint32': return `if (${varName} != 0u)`;
          case 'int64': case 'i64': return `if (${varName} != 0L)`;
          case 'uint64': return `if (${varName} != 0UL)`;
          case 'float': case 'double': return `if (${varName} != 0.0)`;
          default: return `if (${varName} != null)`;
        }
      }
      if (field.type === 'string') {
        return explicitDefaultExpr != null && explicitDefaultExpr !== 'null'
          ? `if (${varName} != ${explicitDefaultExpr})`
          : `if (${varName} != null)`;
      }
      if (field.type === 'datetime' || field.type === 'timestamp' || field.type === 'date') return `if (${varName} != default(DateTime))`;
      if (field.type === 'time') return `if (${varName} != default(TimeSpan))`;
      if (field.type === 'decimal' || field.type === 'numeric') return `if (${varName} != 0m)`;
      if (ast && this.isEnumType(field.type, ast, currentNamespace)) {
        if (explicitDefaultExpr != null && explicitDefaultExpr !== 'null') return `if (${varName} != ${explicitDefaultExpr})`;
        return `if ((int)${varName} != 0)`;
      }
      if (ast) {
        const resolvedCSharp = this.getCSharpType(field.type, ast, currentNamespace);
        const valueTypeConditions: [string, string][] = [
          ['long', 'if (${varName} != 0L)'],
          ['ulong', 'if (${varName} != 0UL)'],
          ['int', 'if (${varName} != 0)'],
          ['uint', 'if (${varName} != 0u)'],
          ['short', 'if (${varName} != 0)'],
          ['ushort', 'if (${varName} != 0)'],
          ['byte', 'if (${varName} != 0)'],
          ['bool', 'if (${varName})'],
          ['double', 'if (${varName} != 0.0)'],
          ['float', 'if (${varName} != 0f)'],
          ['Single', 'if (${varName} != 0f)'],
          ['DateTime', 'if (${varName} != default(DateTime))'],
          ['TimeSpan', 'if (${varName} != default(TimeSpan))'],
          ['decimal', 'if (${varName} != 0m)'],
        ];
        for (const [t, cond] of valueTypeConditions) {
          if (resolvedCSharp === t) return cond.replace(/\$\{varName\}/g, varName);
        }
      }
      if (ast && this.isPrimitiveType(field.type, ast, currentNamespace)) {
        if (explicitDefaultExpr !== null && explicitDefaultExpr !== 'null') {
          const resolvedType = this.getCSharpType(field.type, ast, currentNamespace);
          const longSuffix = (resolvedType === 'long' && /^\d+$/.test(explicitDefaultExpr)) ? 'L' : '';
          return `if (${varName} != ${explicitDefaultExpr}${longSuffix})`;
        }
        const resolvedType = this.getCSharpType(field.type, ast, currentNamespace);
        if (resolvedType === 'long') return `if (${varName} != 0L)`;
        if (resolvedType === 'ulong') return `if (${varName} != 0UL)`;
        if (resolvedType === 'int') return `if (${varName} != 0)`;
        if (resolvedType === 'uint') return `if (${varName} != 0u)`;
        if (resolvedType === 'short') return `if (${varName} != 0)`;
        if (resolvedType === 'ushort') return `if (${varName} != 0)`;
        if (resolvedType === 'byte') return `if (${varName} != 0)`;
        if (resolvedType === 'double') return `if (${varName} != 0.0)`;
        if (resolvedType === 'float' || resolvedType === 'Single') return `if (${varName} != 0f)`;
        if (resolvedType === 'bool') return `if (${varName})`;
        if (resolvedType === 'DateTime') return `if (${varName} != default(DateTime))`;
        if (resolvedType === 'TimeSpan') return `if (${varName} != default(TimeSpan))`;
        if (resolvedType === 'decimal') return `if (${varName} != 0m)`;
      }
      if (ast && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
        return `if (true)  // deuk geometry struct (value type)`;
      }
    }
    return `if (${varName} != null)`;
  }

  /** generateWriteField와 동일 로직이지만, this.X 대신 임의 변수명에서 읽는다. */
  private generateWriteExpressionForVar(varName: string, field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string): string {
    const tType = this.getTType(field.type, ast, currentNamespace);

    if (typeof field.type === 'string') {
      switch (field.type) {
        case 'bool': case 'byte': case 'int8': case 'int16': case 'int32': case 'int64':
        case 'uint8': case 'uint16': case 'uint32': case 'uint64':
        case 'float': case 'double': case 'string': case 'binary':
          return `DeukPackSerializer.WriteValue(oprot, ${tType}, ${varName});`;
        case 'datetime': case 'timestamp':
          return `DeukPackSerializer.WriteValue(oprot, DpWireType.Int64, ${varName}.Ticks);`;
        case 'date':
          return `DeukPackSerializer.WriteValue(oprot, DpWireType.Int32, ${varName}.Year * 10000 + ${varName}.Month * 100 + ${varName}.Day);`;
        case 'time':
          return `DeukPackSerializer.WriteValue(oprot, DpWireType.Int32, (int)${varName}.TotalMilliseconds);`;
        case 'decimal': case 'numeric':
          return `DeukPackSerializer.WriteValue(oprot, DpWireType.String, ${varName}.ToString(System.Globalization.CultureInfo.InvariantCulture));`;
        default:
          return `DeukPackSerializer.WriteValue(oprot, ${tType}, ${varName});`;
      }
    }

    if (typeof field.type === 'object' && 'type' in field.type) {
      switch (field.type.type) {
        case 'list':
        case 'array': {
          const et = this.getTType(field.type.elementType, ast, currentNamespace);
          const ect = this.getCSharpType(field.type.elementType, ast, currentNamespace);
          return `DeukPackSerializer.WriteList<${ect}>(oprot, ${et}, ${varName});`;
        }
        case 'set': {
          const et = this.getTType(field.type.elementType, ast, currentNamespace);
          const ect = this.getCSharpType(field.type.elementType, ast, currentNamespace);
          return `DeukPackSerializer.WriteSet<${ect}>(oprot, ${et}, ${varName});`;
        }
        case 'map': {
          const kt = this.getTType(field.type.keyType, ast, currentNamespace);
          const vt = this.getTType(field.type.valueType, ast, currentNamespace);
          const kct = this.getCSharpType(field.type.keyType, ast, currentNamespace);
          const vct = this.getCSharpType(field.type.valueType, ast, currentNamespace);
          return `DeukPackSerializer.WriteMap<${kct}, ${vct}>(oprot, ${kt}, ${vt}, ${varName});`;
        }
        default:
          return `DeukPackSerializer.WriteValue(oprot, ${tType}, ${varName});`;
      }
    }

    return `DeukPackSerializer.WriteValue(oprot, ${tType}, ${varName});`;
  }

  // generateWriteListElement is no longer needed - handled by DeukPackSerializer recursively

  private generateReadList(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string): string {
    const fieldName = this.capitalize(field.name);
    if (
      typeof field.type === 'object' &&
      'type' in field.type &&
      (field.type.type === 'list' || field.type.type === 'array')
    ) {
      const elementType = this.getTType(field.type.elementType, ast, currentNamespace);
      const csharpElementType = this.getCSharpType(field.type.elementType, ast, currentNamespace);
      return `this.${fieldName} = DeukPackSerializer.ReadList<${csharpElementType}>(iprot, ${elementType});`;
    }
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace);
    return `this.${fieldName} = (${csharpType})DeukPackSerializer.ReadValue(iprot, DpWireType.List, typeof(${csharpType}))!;`;
  }

  private generateReadSet(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string): string {
    const fieldName = this.capitalize(field.name);
    if (typeof field.type === 'object' && 'type' in field.type && field.type.type === 'set') {
      const elementType = this.getTType(field.type.elementType, ast, currentNamespace);
      const csharpElementType = this.getCSharpType(field.type.elementType, ast, currentNamespace);
      return `this.${fieldName} = DeukPackSerializer.ReadSet<${csharpElementType}>(iprot, ${elementType});`;
    }
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace);
    return `this.${fieldName} = (${csharpType})DeukPackSerializer.ReadValue(iprot, DpWireType.Set, typeof(${csharpType}))!;`;
  }

  private generateReadMap(field: DeukPackField, ast?: DeukPackAST, currentNamespace?: string): string {
    const fieldName = this.capitalize(field.name);
    if (typeof field.type === 'object' && 'type' in field.type && field.type.type === 'map') {
      const keyType = this.getTType(field.type.keyType, ast, currentNamespace);
      const valueType = this.getTType(field.type.valueType, ast, currentNamespace);
      const csharpKeyType = this.getCSharpType(field.type.keyType, ast, currentNamespace);
      const csharpValueType = this.getCSharpType(field.type.valueType, ast, currentNamespace);
      return `this.${fieldName} = DeukPackSerializer.ReadMap<${csharpKeyType}, ${csharpValueType}>(iprot, ${keyType}, ${valueType});`;
    }
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace);
    return `this.${fieldName} = (${csharpType})DeukPackSerializer.ReadValue(iprot, DpWireType.Map, typeof(${csharpType}))!;`;
  }

  // generateReadListElement is no longer needed - handled by DeukPackSerializer recursively

  private groupByNamespace(ast: DeukPackAST & { services?: DeukPackService[] }): { [namespace: string]: { enums: DeukPackEnum[], structs: DeukPackStruct[], typedefs: any[], constants: any[], services: DeukPackService[] } } {
    const groups: { [namespace: string]: { enums: DeukPackEnum[], structs: DeukPackStruct[], typedefs: any[], constants: any[], services: DeukPackService[] } } = {};
    const namespaces = ast.namespaces.map(ns => ns.name);
    if (namespaces.length === 0) {
      namespaces.push('Generated');
    }
    for (const ns of namespaces) {
      groups[ns] = { enums: [], structs: [], typedefs: [], constants: [], services: [] };
    }
    for (const enumDef of ast.enums) {
      const ns = this.getEnumNamespace(enumDef, ast);
      if (groups[ns]) groups[ns].enums.push(enumDef);
    }
    for (const struct of ast.structs) {
      const ns = this.getStructNamespace(struct, ast);
      if (groups[ns]) groups[ns].structs.push(struct);
    }
    for (const typedef of ast.typedefs) {
      const ns = this.getTypedefNamespace(typedef, ast);
      if (groups[ns]) groups[ns].typedefs.push(typedef);
    }
    for (const constant of ast.constants) {
      const ns = this.getConstantNamespace(constant, ast);
      if (groups[ns]) groups[ns].constants.push(constant);
    }
    for (const service of ast.services || []) {
      const ns = this.getServiceNamespace(service, ast);
      if (groups[ns]) groups[ns].services.push(service);
    }
    return groups;
  }

  private getServiceNamespace(service: DeukPackService, ast: DeukPackAST): string {
    const mapped = service.sourceFile && ast.fileNamespaceMap ? ast.fileNamespaceMap[service.sourceFile] : undefined;
    if (mapped) return mapped;
    if (service.sourceFile) {
      const ns = ast.namespaces.find(n => (n.language === '*' || n.language === 'csharp') && n.sourceFile === service.sourceFile);
      if (ns && ns.name) return ns.name;
    }
    const def = ast.namespaces.find(n => n.language === '*' || n.language === 'csharp');
    return (def && def.name) ? def.name : 'Generated';
  }

  private generateService(service: DeukPackService, ast: DeukPackAST, namespace: string): string[] {
    const opts = (this as any)._genOptions as GenerationOptions & { defineVersionFile?: string };
    const ifaceMethods: string[] = [];
    const staticMethods: string[] = [];
    for (const method of service.methods) {
      const retCs = this.getCSharpType(method.returnType, ast, namespace);
      const params = (method.parameters || []).map((p) => `${this.getCSharpType(p.type, ast, namespace)} ${p.name}`).join(', ');
      ifaceMethods.push(`    ${retCs} ${method.name}(${params});`);
      if (service.name === 'ThriftDefineService' && method.name === 'GetDefineVersion') {
        let versionValue = '"unknown"';
        if (opts?.defineVersionFile) {
          try {
            const content = fsSync.readFileSync(path.resolve(opts.defineVersionFile), 'utf-8').trim();
            versionValue = JSON.stringify(content);
          } catch {
            versionValue = '"unknown"';
          }
        }
        staticMethods.push(`    public static ${retCs} ${method.name}(${params}) => ${versionValue};`);
      } else {
        staticMethods.push(`    public static ${retCs} ${method.name}(${params}) => default;`);
      }
    }
    const text = this.renderCSharpTpl('ServiceStub.cs.tpl', {
      SERVICE_NAME: service.name,
      INTERFACE_METHODS: ifaceMethods.join('\n'),
      STATIC_METHODS: staticMethods.join('\n'),
    });
    return text.replace(/\r\n/g, '\n').split('\n');
  }

  private getEnumNamespace(enumDef: DeukPackEnum, ast: DeukPackAST): string {
    const norm = (p: string) => p.replace(/\\/g, '/');
    // 파일 경로 기반으로 네임스페이스 찾기
    if (enumDef.sourceFile && ast.fileNamespaceMap) {
      const namespace = ast.fileNamespaceMap[enumDef.sourceFile];
      if (namespace) {
        return namespace;
      }
      const normalized = norm(enumDef.sourceFile);
      const entry = Object.entries(ast.fileNamespaceMap).find(([k]) => norm(k) === normalized);
      if (entry) {
        return entry[1];
      }
    }
    
    // Enum의 sourceFile과 같은 파일의 네임스페이스 찾기
    if (enumDef.sourceFile) {
      const sf = enumDef.sourceFile;
      const namespace = ast.namespaces.find(ns => 
        (ns.language === '*' || ns.language === 'csharp') && 
        ns.sourceFile && norm(ns.sourceFile) === norm(sf)
      );
      if (namespace) {
        return namespace.name;
      }
    }
    
    // Fallback: 첫 번째 네임스페이스 또는 'Generated'
    const namespace = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
    return namespace ? namespace.name : 'Generated';
  }

  private getStructNamespace(struct: DeukPackStruct, ast: DeukPackAST): string {
    const norm = (p: string) => p.replace(/\\/g, '/');
    // 파일 경로 기반으로 네임스페이스 찾기
    if (struct.sourceFile && ast.fileNamespaceMap) {
      const namespace = ast.fileNamespaceMap[struct.sourceFile];
      if (namespace) {
        return namespace;
      }
      const normalized = norm(struct.sourceFile);
      const entry = Object.entries(ast.fileNamespaceMap).find(([k]) => norm(k) === normalized);
      if (entry) {
        return entry[1];
      }
    }
    
    // 구조체의 sourceFile과 같은 파일의 네임스페이스 찾기
    if (struct.sourceFile) {
      const sf = struct.sourceFile;
      const namespace = ast.namespaces.find(ns => 
        (ns.language === '*' || ns.language === 'csharp') && 
        ns.sourceFile && norm(ns.sourceFile) === norm(sf)
      );
      if (namespace) {
        return namespace.name;
      }
    }
    
    // Fallback: 첫 번째 네임스페이스 또는 'Generated'
    const namespace = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
    return namespace ? namespace.name : 'Generated';
  }

  private getTypedefNamespace(typedef: any, ast: DeukPackAST): string {
    const norm = (p: string) => p.replace(/\\/g, '/');
    if (typedef.sourceFile && ast.fileNamespaceMap) {
      const key = ast.fileNamespaceMap[typedef.sourceFile];
      if (key) return key;
      const normalized = norm(typedef.sourceFile);
      const entry = Object.entries(ast.fileNamespaceMap).find(([k]) => norm(k) === normalized);
      if (entry) return entry[1];
    }
    if (typedef.sourceFile) {
      const ns = ast.namespaces.find(ns =>
        (ns.language === '*' || ns.language === 'csharp') &&
        ns.sourceFile && norm(ns.sourceFile) === norm(typedef.sourceFile)
      );
      if (ns) return ns.name;
    }
    
    // Fallback: 첫 번째 네임스페이스 또는 'Generated'
    const namespace = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
    return namespace ? namespace.name : 'Generated';
  }

  private getConstantNamespace(constant: any, ast: DeukPackAST): string {
    const norm = (p: string) => p.replace(/\\/g, '/');
    // 파일 경로 기반으로 네임스페이스 찾기
    if (constant.sourceFile && ast.fileNamespaceMap) {
      const namespace = ast.fileNamespaceMap[constant.sourceFile];
      if (namespace) {
        return namespace;
      }
      const normalized = norm(constant.sourceFile);
      const entry = Object.entries(ast.fileNamespaceMap).find(([k]) => norm(k) === normalized);
      if (entry) {
        return entry[1];
      }
    }
    
    // Constant의 sourceFile과 같은 파일의 네임스페이스 찾기
    if (constant.sourceFile) {
      const sf = constant.sourceFile;
      const namespace = ast.namespaces.find(ns => 
        (ns.language === '*' || ns.language === 'csharp') && 
        ns.sourceFile && norm(ns.sourceFile) === norm(sf)
      );
      if (namespace) {
        return namespace.name;
      }
    }
    
    // Fallback: 첫 번째 네임스페이스 또는 'Generated'
    const namespace = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
    return namespace ? namespace.name : 'Generated';
  }

  /** AST 조회로만 판별. currentNamespace 있으면 short name 해석. */
  private isPrimitiveType(type: any, ast: DeukPackAST, currentNamespace?: string): boolean {
    return this.resolveTypeToASTDefinition(type, currentNamespace, ast)?.kind === 'primitive';
  }

  /** AST 조회로만 판별 (휴리스틱 없음). currentNamespace 있으면 short name 해석. */
  private isEnumType(type: any, ast: DeukPackAST, currentNamespace?: string): boolean {
    return this.resolveTypeToASTDefinition(type, currentNamespace, ast)?.kind === 'enum';
  }

  /** AST 조회로만 판별. currentNamespace 있으면 short name 해석. */
  private isEnumTypeFullName(typeStr: string, ast: DeukPackAST, currentNamespace?: string): boolean {
    return this.resolveTypeToASTDefinition(typeStr, currentNamespace, ast)?.kind === 'enum';
  }

  /** 풀네임 또는 short name( currentNamespace 있을 때)으로 enum 정의 반환 */
  private findEnumByFullName(ast: DeukPackAST | undefined, typeStr: string, currentNamespace?: string): DeukPackEnum | null {
    if (!ast?.enums || !typeStr) return null;
    const fullName = currentNamespace !== undefined ? this.resolveTypeToFullName(typeStr, currentNamespace, ast) : typeStr;
    for (const enumDef of ast.enums) {
      if (this.getEnumFullName(enumDef, ast) === fullName) return enumDef;
    }
    return null;
  }

  /** 원시 스키마 타입이면 true (typedef 포함, AST 기준). C# 출력에 원시 타입명(i32 등)이 나오면 안 됨. */
  private isPrimitiveSchemaType(typeStr: string, ast?: DeukPackAST, currentNamespace?: string): boolean {
    return ast ? this.resolveTypeToASTDefinition(typeStr, currentNamespace, ast)?.kind === 'primitive' : false;
  }

  /** 값 이름으로 AST에 정의된 enum 풀네임 반환. 동일 값 이름이 여러 enum에 있으면 currentNamespace와 같은 네임스페이스 enum 우선. */
  private findEnumFullNameByValueName(ast: DeukPackAST | undefined, valueName: string, currentNamespace?: string): string | null {
    if (!ast?.enums || !valueName) return null;
    let fallback: string | null = null;
    for (const e of ast.enums) {
      if (!Object.prototype.hasOwnProperty.call(e.values, valueName)) continue;
      const full = this.getEnumFullName(e, ast);
      if (currentNamespace && full.startsWith(currentNamespace + '.')) return full;
      if (!fallback) fallback = full;
    }
    return fallback;
  }

  /** C# 타입 이름이 AST에 정의된 struct인지. AST 조회만 사용. */
  private isStructCSharpType(csharpTypeName: string, ast: DeukPackAST): boolean {
    return this.resolveTypeToASTDefinition(csharpTypeName, undefined, ast)?.kind === 'record';
  }

  /** AST 조회로만 판별. currentNamespace 있으면 short name 해석. */
  private isStructTypeFullName(typeStr: string, ast: DeukPackAST, currentNamespace?: string): boolean {
    return this.resolveTypeToASTDefinition(typeStr, currentNamespace, ast)?.kind === 'record';
  }

  /** 필드 타입이 AST에 정의된 struct인지. list/set/map 요소가 아닌 필드 타입 자체가 struct일 때 true. currentNamespace 있으면 short name 해석. */
  private isStructType(type: any, ast: DeukPackAST, currentNamespace?: string): boolean {
    return this.resolveTypeToASTDefinition(type, currentNamespace, ast)?.kind === 'record';
  }

  /** IDL `geometry` 어노테이션 record → C# `deuk` partial struct (값 타입). */
  private isGeometryDeukStruct(type: any, ast?: DeukPackAST, currentNamespace?: string): boolean {
    if (!ast || typeof type !== 'string') return false;
    const def = this.resolveTypeToASTDefinition(type, currentNamespace, ast);
    if (def?.kind !== 'record') return false;
    return !!(def.def as DeukPackStruct).annotations?.['geometry'];
  }

  /** CreateDefault() 내 필드 초기화 RHS: IDL 기본값이 있으면 사용(호환), 없으면 struct→CreateDefault(), list/set/map→빈 컬렉션, primitive/enum→타입 기본값 */
  private generateCreateDefaultRhs(field: DeukPackField, ast?: DeukPackAST, _currentNamespace?: string, parentStruct?: DeukPackStruct): string {
    if (parentStruct && ast && _currentNamespace) {
      const msgDefault = this.buildMessageFirstFieldDefault(parentStruct, field, ast, _currentNamespace);
      if (msgDefault != null) return msgDefault;
    }
    // 필드에 명시된 기본값이 있으면 CreateDefault()에서도 동일하게 사용
    if (field.defaultValue !== undefined && ast) {
      const objInit = this.getCSharpStructObjectInitializer(field.defaultValue, field.type, _currentNamespace, ast);
      if (objInit !== null) return objInit;
      const explicitDefault = this.getCSharpDefaultValue(field.defaultValue, field.type, ast, _currentNamespace);
      if (explicitDefault !== 'null') return explicitDefault;
    }

    const opt = !field.required;

    if (typeof field.type === 'string') {
      switch (field.type) {
        case 'bool': return 'false';
        case 'byte':
        case 'int8':
        case 'int16':
        case 'int32':
        case 'int64':
        case 'uint8':
        case 'uint16':
        case 'uint32':
        case 'uint64':
        case 'float':
        case 'double':
          if (field.type === 'int64') return '0L';
          if (field.type === 'uint64') return '0UL';
          if (field.type === 'uint32') return '0u';
          return '0';
        case 'string': return '""';
        case 'binary': return opt ? 'null' : 'new byte[0]';
        case 'datetime':
        case 'timestamp':
        case 'date': return 'default(DateTime)';
        case 'time': return 'default(TimeSpan)';
        case 'decimal':
        case 'numeric': return '0m';
        default: {
          const resolved = ast ? this.getCSharpType(field.type, ast, _currentNamespace) : '';
          if (resolved === 'string') return '""';
          if (resolved === 'bool') return 'false';
          if (resolved === 'int' || resolved === 'short' || resolved === 'byte' || resolved === 'ushort') return '0';
          if (resolved === 'long') return '0L';
          if (resolved === 'ulong') return '0UL';
          if (resolved === 'uint') return '0u';
          if (resolved === 'double') return '0';
          if (resolved === 'DateTime') return 'default(DateTime)';
          if (resolved === 'TimeSpan') return 'default(TimeSpan)';
          if (resolved === 'decimal') return '0m';
          if (ast && this.isStructType(field.type, ast, _currentNamespace)) {
            const typeForDefault = this.getCSharpType(field.type, ast, _currentNamespace);
            if (this.isGeometryDeukStruct(field.type, ast, _currentNamespace)) {
              return `default(${typeForDefault})`;
            }
            return `${typeForDefault}.CreateDefault()`;
          }
          if (ast && this.isEnumType(field.type, ast, _currentNamespace)) {
            const typeForCast = this.getCSharpType(field.type, ast, _currentNamespace);
            return `(${typeForCast})0`;
          }
          return 'null';
        }
      }
    }
    if (typeof field.type === 'object' && field.type !== null && 'type' in field.type) {
      switch ((field.type as any).type) {
        case 'list':
        case 'array': {
          const elem = this.getCSharpType((field.type as any).elementType, ast, _currentNamespace);
          return `new List<${elem}>()`;
        }
        case 'set': {
          const elem = this.getCSharpType((field.type as any).elementType, ast, _currentNamespace);
          return `new HashSet<${elem}>()`;
        }
        case 'map': {
          const k = this.getCSharpType((field.type as any).keyType, ast, _currentNamespace);
          const v = this.getCSharpType((field.type as any).valueType, ast, _currentNamespace);
          return `new Dictionary<${k}, ${v}>()`;
        }
        case 'tablelink':
          return '0L';
        default: return 'null';
      }
    }
    return 'null';
  }

  private generateCloneField(field: DeukPackField, fieldName: string, ast?: DeukPackAST, currentNamespace?: string): string {
    const opt = !field.required;
    const enableNullable = (this as any)._csharpNullable;
    const nullSuffix = (opt && !enableNullable) ? '!' : '';
    const wrapOpt = (stmt: string) => opt ? `clone.${fieldName} = this.${fieldName} != null ? (${stmt}) : null${nullSuffix};` : `clone.${fieldName} = ${stmt};`;

    if (typeof field.type === 'string') {
      switch (field.type) {
        case 'bool':
        case 'byte':
        case 'int8':
        case 'int16':
        case 'int32':
        case 'int64':
        case 'uint8':
        case 'uint16':
        case 'uint32':
        case 'uint64':
        case 'float':
        case 'double':
        case 'datetime':
        case 'timestamp':
        case 'date':
        case 'time':
        case 'decimal':
        case 'numeric':
          return `clone.${fieldName} = this.${fieldName};`;
        case 'string':
          return `clone.${fieldName} = this.${fieldName};`;
        case 'binary':
          return wrapOpt(`(byte[])this.${fieldName}.Clone()`);
        default:
          if (ast && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
            return `clone.${fieldName} = this.${fieldName};`;
          }
          if (ast && (this.isEnumType(field.type, ast, currentNamespace) || this.isPrimitiveType(field.type, ast, currentNamespace) || !this.isStructType(field.type, ast, currentNamespace))) {
            return `clone.${fieldName} = this.${fieldName};`;
          }
          return wrapOpt(`this.${fieldName}.Clone()`);
      }
    }
    if (typeof field.type === 'object' && 'type' in field.type) {
      switch (field.type.type) {
        case 'list':
        case 'array':
          return wrapOpt(`this.${fieldName}.Select(item => ${this.generateCloneElement(field.type.elementType, ast, 'item', currentNamespace)}).ToList()`);
        case 'set':
          return wrapOpt(`this.${fieldName}.Select(item => ${this.generateCloneElement(field.type.elementType, ast, 'item', currentNamespace)}).ToHashSet()`);
        case 'map': {
          const keyClone = this.generateCloneElement(field.type.keyType, ast, 'kvp.Key', currentNamespace);
          const valueClone = this.generateCloneElement(field.type.valueType, ast, 'kvp.Value', currentNamespace);
          return wrapOpt(`this.${fieldName}.ToDictionary(kvp => ${keyClone}, kvp => ${valueClone})`);
        }
        case 'tablelink':
          return `clone.${fieldName} = this.${fieldName};`;
        default:
          return wrapOpt(`this.${fieldName}.Clone()`);
      }
    }
    return wrapOpt(`this.${fieldName}.Clone()`);
  }

  private generateCloneElement(elementType: any, ast?: DeukPackAST, varName: string = 'item', currentNamespace?: string): string {
    // 1. 객체 타입인 경우
    if (typeof elementType === 'object' && elementType !== null) {
      if ('type' in elementType) {
        switch (elementType.type) {
          case 'tablelink':
            return varName;
          case 'list':
          case 'array':
            return `${varName}.Select(item => ${this.generateCloneElement(elementType.elementType, ast, 'item', currentNamespace)}).ToList()`;
          case 'set':
            return `${varName}.Select(item => ${this.generateCloneElement(elementType.elementType, ast, 'item', currentNamespace)}).ToHashSet()`;
          case 'map': {
            const keyClone = this.generateCloneElement(elementType.keyType, ast, 'kvp.Key', currentNamespace);
            const valueClone = this.generateCloneElement(elementType.valueType, ast, 'kvp.Value', currentNamespace);
            return `${varName}.ToDictionary(kvp => ${keyClone}, kvp => ${valueClone})`;
          }
          default:
            return `${varName}.Clone()`;
        }
      }
      return `${varName}.Clone()`;
    }
    
    // 2. 문자열 타입인 경우
    if (typeof elementType === 'string') {
      // 기본 primitive 타입 처리
      const primitiveTypes = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'double', 'string'];
      if (primitiveTypes.includes(elementType)) {
        return varName; // primitive는 그대로 사용
      }
      
      // AST를 사용하여 typedef/enum 확인
      if (ast) {
        // enum 타입은 Clone() 불필요
        if (this.isEnumType(elementType, ast, currentNamespace)) {
          return varName;
        }
        
        // typedef로 정의된 primitive 타입인지 확인
        if (this.isPrimitiveType(elementType, ast, currentNamespace)) {
          return varName;
        }
        
        // getCSharpType으로 실제 타입 확인
        const resolvedType = this.getCSharpType(elementType, ast);
        const csharpPrimitiveTypes = ['bool', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'double', 'string'];
        if (csharpPrimitiveTypes.includes(resolvedType)) {
          return varName;
        }
      }
      
      if (elementType === 'binary') {
        return `${varName}.Clone()`;
      }
      if (ast && this.isGeometryDeukStruct(elementType, ast, currentNamespace)) {
        return varName;
      }
      return `${varName}.Clone()`;
    }
    return `${varName}.Clone()`;
  }

  private generateToStringField(field: DeukPackField, fieldName: string, ast?: DeukPackAST, currentNamespace?: string): string {
    const csharpType = this.getCSharpType(field.type, ast, currentNamespace);
    const isStruct = ast && (this.isStructType(field.type, ast, currentNamespace) || this.isStructCSharpType(csharpType, ast));

    if (typeof field.type === 'string') {
      const primitiveTypes = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'double'];
      const dbTypes = ['datetime', 'timestamp', 'date', 'time', 'decimal', 'numeric'];
      if (primitiveTypes.includes(field.type) || field.type === 'string') {
        return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}).AppendLine(",");`;
      }
      if (dbTypes.includes(field.type)) {
        return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
      }
      if (field.type === 'binary') {
        return `sb.Append(ci).Append("${field.name}: [").Append(this.${fieldName}?.Length ?? 0).AppendLine(" bytes],");`;
      }
      if (ast) {
        const resolvedType = this.getCSharpType(field.type, ast, currentNamespace);
        const csharpValueTypes = ['bool', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'double', 'float', 'Single'];
        if (csharpValueTypes.includes(resolvedType) || this.isEnumType(field.type, ast, currentNamespace)) {
          return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
        }
      }
      if (isStruct) {
        // Geometry partial structs (deuk_geometry) implement ToString() only, not ToString(indent).
        if (ast && this.isGeometryDeukStruct(field.type, ast, currentNamespace)) {
          return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
        }
        return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString(ci) ?? "null").AppendLine(",");`;
      }
      return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString() ?? "null").AppendLine(",");`;
    }
    if (typeof field.type === 'object' && 'type' in field.type) {
      switch (field.type.type) {
        case 'tablelink':
          return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
        case 'list':
        case 'array':
          return `sb.Append(ci).Append("${field.name}: [").Append(this.${fieldName}?.Count ?? 0).AppendLine(" items],");`;
        case 'set':
          return `sb.Append(ci).Append("${field.name}: {").Append(this.${fieldName}?.Count ?? 0).AppendLine(" items},");`;
        case 'map':
          return `sb.Append(ci).Append("${field.name}: {").Append(this.${fieldName}?.Count ?? 0).AppendLine(" pairs},");`;
        default:
          if (isStruct) {
            return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString(ci) ?? "null").AppendLine(",");`;
          }
          return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString() ?? "null").AppendLine(",");`;
      }
    }
    if (isStruct) {
      return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString(ci) ?? "null").AppendLine(",");`;
    }
    if (ast && (this.isPrimitiveType(field.type, ast, currentNamespace) || this.isEnumType(field.type, ast, currentNamespace))) {
      return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}.ToString()).AppendLine(",");`;
    }
    return `sb.Append(ci).Append("${field.name}: ").Append(this.${fieldName}?.ToString() ?? "null").AppendLine(",");`;
  }

  private resolveConstant(value: string, ast: DeukPackAST): number | bigint | null {
    // value 형식: "namespace.constant_name" 또는 "constant_name"
    const parts = value.split('.');
    if (parts.length === 0) return null;
    
    // constant_name만 있는 경우 또는 namespace.constant_name인 경우
    const constantName = parts[parts.length - 1];
    const namespace = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
    
    // AST에서 상수 찾기
    for (const constant of ast.constants) {
      const constName = constant.name.split('.').pop() || constant.name;
      const constFullName = constant.name;
      const constNamespace = constant.name.includes('.') 
        ? constant.name.substring(0, constant.name.lastIndexOf('.')) 
        : '';
      
      // 이름이 일치하는지 확인 (전체 이름 또는 짧은 이름)
      const nameMatches = constName === constantName || constFullName === value;
      
      if (nameMatches) {
        // namespace가 지정되었으면 namespace도 일치해야 함
        if (namespace && constNamespace && constNamespace !== namespace) {
          continue;
        }
        // 상수 값이 숫자(BigInt 포함)인 경우 반환
        if (typeof constant.value === 'number' || typeof constant.value === 'bigint') {
          return constant.value;
        }
        // 상수 값이 문자열인데 숫자로 파싱 가능한 경우
        if (typeof constant.value === 'string') {
          const parsed = parseDeukNumericLiteral(constant.value);
          if (typeof parsed === 'bigint' || !isNaN(parsed)) {
            return parsed;
          }
        }
      }
    }
    
    // 찾지 못한 경우 로그 출력 (디버깅용)
    console.warn(`[DeukPack] Could not resolve constant: ${value}`);
    return null;
  }

  private generateTypedef(typedef: any): string[] {
    // IDL typedef → C# using alias (C# doesn't support typedef)
    // Map primitive/schema types to C# types
    const csharpTypeMap: { [key: string]: string } = {
      'long': 'System.Int64',
      'int64': 'System.Int64',
      'int32': 'System.Int32',
      'int16': 'System.Int16',
      'int8': 'System.SByte',
      'uint32': 'System.UInt32',
      'uint16': 'System.UInt16',
      'uint8': 'System.Byte',
      'uint64': 'System.UInt64',
      'string': 'System.String',
      'int': 'System.Int32',
      'bool': 'System.Boolean',
      'byte': 'System.Byte',
      'float': 'System.Single',
      'double': 'System.Double',
      'binary': 'byte[]'
    };
    
    let csharpType: string;
    if (typeof typedef.type === 'string') {
      csharpType = csharpTypeMap[typedef.type] || this.getCSharpType(typedef.type);
    } else {
      csharpType = this.getCSharpType(typedef.type);
    }
    
    const text = this.renderCSharpTpl('TypedefUsingAlias.cs.tpl', {
      TYPEDEF_NAME: typedef.name,
      TYPEDEF_TYPE: csharpType,
    });
    return text.replace(/\r\n/g, '\n').split('\n');
  }

  private generateConstant(constant: any, ast?: DeukPackAST): string[] {
    const csharpType = this.getCSharpType(constant.type, ast);
    const value = this.getCSharpDefaultValue(constant.value, constant.type, ast);
    const isReferenceType =
      (typeof constant.type === 'object' &&
        constant.type !== null &&
        (constant.type.type === 'map' ||
          constant.type.type === 'list' ||
          constant.type.type === 'array' ||
          constant.type.type === 'set')) ||
      (typeof csharpType === 'string' &&
        (csharpType.startsWith('Dictionary') || csharpType.startsWith('List') || csharpType.startsWith('HashSet')));
    const line = isReferenceType
      ? `  public static readonly ${csharpType} ${constant.name} = ${value};`
      : `  public const ${csharpType} ${constant.name} = ${value};`;
    const text = this.renderCSharpTpl('ConstantDeclaration.cs.tpl', { CONSTANT_LINE: line });
    return text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  }

  // ─── Geometry: IDL fields + full-field ctor + IEquatable only (vector/Unity: deuk_geometry.impl.cs partial)
  private generateGeometryStruct(
    struct: DeukPackStruct,
    _ast: DeukPackAST,
    _currentNamespace?: string
  ): string[] {
    const name = struct.name;
    const fieldNames = struct.fields.map((f) => f.name);

    const memberLines: string[] = [];
    for (const f of struct.fields) {
      memberLines.push(`    public float ${f.name};`);
    }
    memberLines.push('');
    const ctorParams = fieldNames.map((n) => `float ${n}`).join(', ');
    memberLines.push(`    public ${name}(${ctorParams})`);
    memberLines.push('    {');
    for (const n of fieldNames) {
      memberLines.push(`      this.${n} = ${n};`);
    }
    memberLines.push('    }');
    memberLines.push('');
    const eqConds = fieldNames.map((n) => `this.${n} == other.${n}`).join(' && ');
    memberLines.push(`    public bool Equals(${name} other) => ${eqConds};`);
    memberLines.push(`    public override bool Equals(object obj) => obj is ${name} o && Equals(o);`);
    memberLines.push('    public override int GetHashCode()');
    memberLines.push('    {');
    memberLines.push('      unchecked');
    memberLines.push('      {');
    memberLines.push('        int h = 17;');
    for (const n of fieldNames) {
      memberLines.push(`        h = h * 31 + ${n}.GetHashCode();`);
    }
    memberLines.push('        return h;');
    memberLines.push('      }');
    memberLines.push('    }');
    memberLines.push(`    public static bool operator ==(${name} a, ${name} b) => a.Equals(b);`);
    memberLines.push(`    public static bool operator !=(${name} a, ${name} b) => !a.Equals(b);`);
    memberLines.push('');
    const tpl = this._tpl.load('GeometryStruct.cs.tpl');
    const enableNullable = (this as any)._csharpNullable === true;
    const rendered = applyCodegenPlaceholders(tpl, {
      STRUCT_NAME: name,
      MEMBERS: memberLines.join('\n'),
      '?': enableNullable ? '?' : '',
    });
    return rendered.replace(/\r\n/g, '\n').split('\n');
  }

}