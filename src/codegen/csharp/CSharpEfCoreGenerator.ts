import { DeukPackAST, DeukPackStruct, DeukPackException } from '../../types/DeukPackTypes';
import { applyCodegenPlaceholders } from '../templateRender';
import { CodegenTemplateHost } from '../codegenTemplateHost';
import { CSharpTypeHelper } from './CSharpTypeHelper';

export interface CSharpEfContext {
  tpl: CodegenTemplateHost;
  isMetaContainerStruct: (s: DeukPackStruct) => boolean;
  renderCSharpTpl: (relPath: string, values: Record<string, string>) => string;
}

export class CSharpEfCoreGenerator {
  constructor(private ctx: CSharpEfContext) {}

  public generateEfDbContext(
    metaTableDefs: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }>,
    entityDefs: Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> = []
  ): string {
    const capitalize = CSharpTypeHelper.capitalize;
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
      onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().ToTable("${CSharpTypeHelper.escapeCSharpStringContent(d.category)}");`);
      if (d.keyFieldNames.length > 1) {
        onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().HasKey(e => ${toPropExpr(d.keyFieldNames)});`);
      }
    }
    for (const d of entityDefs) {
      onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().ToTable("${CSharpTypeHelper.escapeCSharpStringContent(d.category)}");`);
      if (d.keyFieldNames.length > 1) {
        onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().HasKey(e => ${toPropExpr(d.keyFieldNames)});`);
      }
      for (const idx of d.indexColumns) {
        onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().HasIndex(e => ${toPropExpr(idx)});`);
      }
      for (const uq of d.uniqueColumns) {
        onModelBodyLines.push(`      modelBuilder.Entity<${d.rowTypeFull}>().HasIndex(e => ${toPropExpr(uq)}).IsUnique();`);
      }
    }
    const onModelBody = onModelBodyLines.length === 0 ? '' : onModelBodyLines.join('\n') + '\n';
    const tpl = this.ctx.tpl.load('DeukPackDbContext.cs.tpl');
    return `${applyCodegenPlaceholders(tpl, { DBSET_PROPERTIES: dbSetProps, ONMODEL_BODY: onModelBody }).trimEnd()}\n`;
  }

  public generateMetaTableRegistry(defs: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }>, schemaFingerprint: string): string {
    const esc = CSharpTypeHelper.escapeCSharpStringContent;
    const switchGetContainer = defs.map((d) => `        case "${esc(d.category)}": return typeof(${d.containerTypeFull});`).join('\n');
    const switchGetRow = defs.map((d) => `        case "${esc(d.category)}": return typeof(${d.rowTypeFull});`).join('\n');
    const switchGetKeys = defs.map((d) => {
        const arrLiteral = 'new string[] { ' + d.keyFieldNames.map((k: string) => `"${esc(k)}"`).join(', ') + ' }';
        return `        case "${esc(d.category)}": return ${arrLiteral};`;
      }).join('\n');
    const switchCreateEmpty = defs.map((d) => `        case "${esc(d.category)}": return (IDeukMetaContainer)${d.containerTypeFull}.CreateDefault();`).join('\n');
    
    return this.ctx.renderCSharpTpl('MetaTableRegistry.cs.tpl', {
      FINGERPRINT: esc(schemaFingerprint),
      SWITCH_GETCONTAINER: switchGetContainer,
      SWITCH_GETROW: switchGetRow,
      SWITCH_GETKEYS: switchGetKeys,
      SWITCH_CREATEEMPTY: switchCreateEmpty,
    }).trimEnd() + '\n';
  }

  public collectMetaTableDefinitions(ast: DeukPackAST): Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }> {
    const list: Array<{ category: string; containerTypeFull: string; rowTypeFull: string; keyFieldNames: string[] }> = [];
    for (const struct of ast.structs || []) {
      if (!this.ctx.isMetaContainerStruct(struct)) continue;
      const ns = CSharpTypeHelper.getStructNamespace(struct, ast);
      if (!ns || !ns.endsWith('_meta')) continue;
      const category = ns.replace(/_meta$/, '');
      const containerTypeFull = `${ns}.${struct.name}`;
      const infosType = struct.fields && struct.fields[1] && typeof struct.fields[1].type === 'object' && (struct.fields[1].type as any).type === 'map'
        ? (struct.fields[1].type as any).valueType : null;
      const rowTypeShort = infosType ? CSharpTypeHelper.getCSharpType(infosType, ast, ns) : 'IDeukPack';
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

  public collectEntityDefinitions(ast: DeukPackAST): Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> {
    const list: Array<{ category: string; rowTypeFull: string; keyFieldNames: string[]; indexColumns: string[][]; uniqueColumns: string[][] }> = [];
    for (const struct of ast.structs || []) {
      if (struct.declarationKind !== 'entity') continue;
      const ns = CSharpTypeHelper.getStructNamespace(struct, ast);
      const fullName = ns ? `${ns}.${struct.name}` : struct.name;
      const bracketTable = CSharpTypeHelper.findDeukBracketTagValue(struct.deukBracketAttributes, 'table');
      const tableName = bracketTable ?? (struct.annotations?.['table'] ? String(struct.annotations['table']).replace(/^["']|["']$/g, '').trim() : struct.name);
      
      let keyFieldNames = struct.keyFieldNames;
      if (!keyFieldNames?.length && struct.annotations?.['key']) {
        const raw = String(struct.annotations['key']).replace(/^["']|["']$/g, '').trim();
        if (raw) keyFieldNames = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
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

  public validateTableLinkFields(ast: DeukPackAST, metaTableDefs: any[]): void {
    for (const struct of ast.structs || []) {
      for (const field of struct.fields || []) {
        if (typeof field.type !== 'object' || !field.type || (field.type as any).type !== 'tablelink') continue;
        const tableCategory = (field.type as any).tableCategory as string;
        const keyField = (field.type as any).keyField as string;
        const def = metaTableDefs.find((d) => d.category === tableCategory || d.containerTypeFull.startsWith(tableCategory + '.'));
        if (!def) continue;
        const rowTypeFull = def.rowTypeFull;
        const rowStruct = ast.structs?.find((s) => CSharpTypeHelper.getStructFullName(s, ast) === rowTypeFull);
        if (!rowStruct?.fields?.some((f) => f.name === keyField) && !(keyField === 'tuid' && rowStruct?.fields?.some((f) => f.name === 'meta_id'))) {
          throw new DeukPackException(`tablelink<${tableCategory}, ${keyField}>: 대상 테이블 row 타입 "${rowTypeFull}"에 키 필드 "${keyField}"가 없습니다.`);
        }
      }
    }
  }
}
