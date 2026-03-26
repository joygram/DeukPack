/**
 * DeukPack C++ Generator
 * Output: `<stem>_deuk.h` + `<stem>_deuk.cpp` per IDL source (avoids colliding with hand-written `Foo.h`).
 * Include-only IDL → umbrella `_deuk.h` (forward #includes only).
 */

import * as path from 'path';
import {
  DeukPackAST,
  GenerationOptions,
  DeukPackStruct,
  DeukPackEnum,
  DeukPackConstant,
  DeukPackType,
  DeukPackTypedef,
} from '../../types/DeukPackTypes';
import { CodeGenerator } from '../CodeGenerator';
import { DeukPackEngine } from '../../core/DeukPackEngine';
import { CodegenTemplateHost } from '../codegenTemplateHost';

type TypeGroup = {
  enums: DeukPackEnum[];
  structs: DeukPackStruct[];
  constants: DeukPackConstant[];
  typedefs: DeukPackTypedef[];
};

export class CppGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('cpp');

  private cppHeaderFileName(stem: string): string {
    return `${stem}_deuk.h`;
  }

  private cppSourceFileName(stem: string): string {
    return `${stem}_deuk.cpp`;
  }

  /** IDL namespace `a.b.c` → C++ qualified scope `a::b::c` */
  private cppQualifiedNs(ns: string): string {
    return ns.split('.').filter(Boolean).join('::');
  }

  private renderCppNamespaceOpen(ns: string): string {
    const parts = ns.split('.').filter(Boolean);
    if (parts.length === 0) return '';
    return parts.map((p) => `namespace ${p} {`).join('\n');
  }

  private renderCppNamespaceClose(ns: string): string {
    const parts = ns.split('.').filter(Boolean);
    if (parts.length === 0) return '';
    return parts
      .slice()
      .reverse()
      .map((p) => `} // namespace ${p}`)
      .join('\n');
  }

  async generate(ast: DeukPackAST, _options: GenerationOptions): Promise<{ [filename: string]: string }> {
    DeukPackEngine.resolveExtends(ast);
    const fileGroups = this.groupBySourceFile(ast);
    const out: { [filename: string]: string } = {};

    out['DpProtocol.h'] = this._tpl.load('DpProtocol.h.tpl');

    for (const [sourceFile, group] of Object.entries(fileGroups)) {
      const baseName = this.getBaseNameFromSource(sourceFile);
      if (!baseName || baseName === 'unknown') continue;

      if (group.enums.length + group.structs.length + group.constants.length + group.typedefs.length === 0) {
        continue;
      }

      const hContent = this.generateHeader(baseName, group, ast, _options);
      if (hContent == null) {
        continue;
      }

      const namespaces = new Set<string>();
      for (const e of group.enums) namespaces.add(this.getEnumNamespace(e, ast));
      for (const s of group.structs) namespaces.add(this.getStructNamespace(s, ast));
      for (const c of group.constants) namespaces.add(this.getConstantNamespace(c, ast));
      for (const t of group.typedefs) namespaces.add(this.getTypedefNamespace(t, ast));

      const cppContent = this.generateCppFile(baseName, Array.from(namespaces));

      out[this.cppHeaderFileName(baseName)] = hContent;
      out[this.cppSourceFileName(baseName)] = cppContent;
    }

    const fileIncludes = ast.fileIncludes ?? {};
    for (const [sourceFile, incList] of Object.entries(fileIncludes)) {
      const baseName = this.getBaseNameFromSource(sourceFile);
      if (!baseName || baseName === 'unknown') continue;
      if (out[this.cppHeaderFileName(baseName)]) continue;

      const group = fileGroups[sourceFile];
      const hasDefs =
        group &&
        (group.enums.length + group.structs.length + group.constants.length + group.typedefs.length > 0);
      if (hasDefs) continue;

      if (!incList.length) continue;

      const headerNames = this.idlIncludesToUniqueHeaders(incList, baseName);
      if (headerNames.length === 0) continue;

      const idlNs = this.lookupFileNamespace(sourceFile, ast);
      out[this.cppHeaderFileName(baseName)] = this.generateUmbrellaHeader(headerNames, idlNs);
      out[this.cppSourceFileName(baseName)] = this.generateCppFile(baseName, []);
    }

    return out;
  }

  /** Map IDL include string to generated header name (`<stem>_deuk.h`). */
  private idlIncludeToHeaderName(includeStr: string): string | null {
    const trimmed = includeStr.trim();
    if (!trimmed) return null;
    const base = path.basename(trimmed.replace(/\\/g, '/'));
    const stem = base.replace(/\.(deuk|thrift|proto)$/i, '');
    if (!stem) return null;
    const upper = stem.toUpperCase();
    if (['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'].includes(upper)) return null;
    return this.cppHeaderFileName(stem);
  }

  private idlIncludesToUniqueHeaders(incList: string[], selfBaseName: string): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const selfHeader = this.cppHeaderFileName(selfBaseName);
    for (const inc of incList) {
      const h = this.idlIncludeToHeaderName(inc);
      if (!h) continue;
      if (h === selfHeader) continue;
      if (seen.has(h)) continue;
      seen.add(h);
      ordered.push(h);
    }
    return ordered;
  }

  /**
   * Include-only IDL: forward #includes only. We do not open a C++ namespace here — each generated
   * header uses its own namespace blocks; wrapping #include in namespace X { } would be ill-formed.
   */
  private generateUmbrellaHeader(headerNames: string[], idlNamespace: string | undefined): string {
    const lines: string[] = [];
    lines.push(this._tpl.load('HeaderPreamble.h.tpl').trimEnd());
    lines.push('');
    lines.push('/**');
    lines.push(' * Umbrella header (include-only .deuk). Forward includes only.');
    lines.push(' * Do not wrap these lines in an outer namespace; see each header for its namespace.');
    lines.push(' */');
    if (idlNamespace) {
      lines.push(`// IDL namespace for this file (informational): ${idlNamespace}`);
    }
    lines.push('');
    for (const h of headerNames) {
      lines.push(`#include "${h}"`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private groupBySourceFile(ast: DeukPackAST): { [sourceFile: string]: TypeGroup } {
    const groups: { [sourceFile: string]: TypeGroup } = {};
    const ensure = (sourceFile: string) => {
      if (!groups[sourceFile]) {
        groups[sourceFile] = { enums: [], structs: [], constants: [], typedefs: [] };
      }
    };
    for (const e of ast.enums) {
      const sf = e.sourceFile || 'unknown';
      ensure(sf);
      groups[sf]!.enums.push(e);
    }
    for (const s of ast.structs) {
      const sf = s.sourceFile || 'unknown';
      ensure(sf);
      groups[sf]!.structs.push(s);
    }
    for (const c of ast.constants) {
      const sf = c.sourceFile || 'unknown';
      ensure(sf);
      groups[sf]!.constants.push(c);
    }
    for (const t of ast.typedefs ?? []) {
      const sf = t.sourceFile || 'unknown';
      ensure(sf);
      groups[sf]!.typedefs.push(t);
    }
    return groups;
  }

  private getBaseNameFromSource(sourceFile: string): string {
    const filename = sourceFile.split('/').pop()?.split('\\').pop() || 'unknown';
    const nameWithoutExt = filename.replace(/\.thrift$/i, '').replace(/\.deuk$/i, '').replace(/\.proto$/i, '');
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
    if (reserved.includes(nameWithoutExt.toUpperCase()) || !nameWithoutExt) return 'unknown';
    return nameWithoutExt;
  }



  private getCppType(fieldType: DeukPackType, ast: DeukPackAST, currentNs: string): string {
    if (typeof fieldType === 'string') {
      const prim = this.getCppTypePrimitive(fieldType);
      if (prim) return prim;
      return this.resolveTypeName(fieldType, currentNs, ast);
    }
    if (typeof fieldType === 'object' && fieldType !== null) {
      if (fieldType.type === 'list') {
        const elem = this.getCppType((fieldType as { elementType: DeukPackType }).elementType, ast, currentNs);
        return `std::vector<${elem}>`;
      }
      if (fieldType.type === 'set') {
        const elem = this.getCppType((fieldType as { elementType: DeukPackType }).elementType, ast, currentNs);
        return `std::set<${elem}>`;
      }
      if (fieldType.type === 'map') {
        const k = this.getCppType((fieldType as { keyType: DeukPackType }).keyType, ast, currentNs);
        const v = this.getCppType((fieldType as { valueType: DeukPackType }).valueType, ast, currentNs);
        return `std::map<${k}, ${v}>`;
      }
    }
    return 'void';
  }

  private resolveTypeName(typeStr: string, currentNs: string, ast: DeukPackAST): string {
    if (!typeStr || typeof typeStr !== 'string') return 'void';
    const parts = typeStr.split('.');
    const short = parts[parts.length - 1] ?? typeStr;
    const enumDef = ast.enums.find((e) => e.name === short || e.name === typeStr);
    if (enumDef) {
      const ns = this.lookupFileNamespace(enumDef.sourceFile, ast) ?? currentNs;
      return ns === currentNs ? short : `${this.cppQualifiedNs(ns)}::${short}`;
    }
    const structDef = ast.structs.find((s) => s.name === short || s.name === typeStr);
    if (structDef) {
      const ns = this.lookupFileNamespace(structDef.sourceFile, ast) ?? currentNs;
      return ns === currentNs ? short : `${this.cppQualifiedNs(ns)}::${short}`;
    }
    const typedefDef = ast.typedefs?.find((t) => t.name === short || t.name === typeStr);
    if (typedefDef) {
      return this.getCppType(typedefDef.type, ast, currentNs);
    }
    const prim = this.getCppTypePrimitive(typeStr);
    if (prim) return prim;
    return short;
  }

  private getCppTypePrimitive(typeStr: string): string | null {
    const map: { [k: string]: string } = {
      bool: 'bool',
      byte: 'deuk::int8', i8: 'deuk::int8', int8: 'deuk::int8',
      i16: 'deuk::int16', int16: 'deuk::int16',
      i32: 'deuk::int32', int32: 'deuk::int32',
      i64: 'deuk::int64', int64: 'deuk::int64',
      uint8: 'deuk::uint8', uint16: 'deuk::uint16',
      uint32: 'deuk::uint32', uint64: 'deuk::uint64',
      float: 'deuk::float32', double: 'deuk::float64',
      string: 'std::string', binary: 'std::string',
      datetime: 'int64_t',
      timestamp: 'int64_t',
      date: 'int64_t',
      time: 'int64_t',
    };
    return map[typeStr] ?? null;
  }

  private normPath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  /** Match C#: map keys vs enum/struct sourceFile may differ by separators only. */
  private lookupFileNamespace(sourceFile: string | undefined, ast: DeukPackAST): string | undefined {
    if (!sourceFile || !ast.fileNamespaceMap) return undefined;
    const direct = ast.fileNamespaceMap[sourceFile];
    if (direct) return direct;
    const n = this.normPath(sourceFile);
    const hit = Object.entries(ast.fileNamespaceMap).find(([k]) => this.normPath(k) === n);
    return hit?.[1];
  }

  /**
   * Headers for struct/enum definitions in other IDL stems (e.g. Party uses prologue Hero → #include "cpp_deuk.h").
   */
  private collectCrossSourceHeaderIncludes(baseName: string, group: TypeGroup, ast: DeukPackAST): string[] {
    const headers = new Set<string>();

    const addFromQualifiedType = (typeStr: string) => {
      if (!typeStr || typeof typeStr !== 'string') return;
      if (this.getCppTypePrimitive(typeStr)) return;
      const parts = typeStr.split('.');
      const short = parts[parts.length - 1] ?? typeStr;
      const enumDef = ast.enums.find((e) => e.name === short || e.name === typeStr);
      if (enumDef) {
        const stem = enumDef.sourceFile ? this.getBaseNameFromSource(enumDef.sourceFile) : 'unknown';
        if (stem && stem !== 'unknown' && stem !== baseName) headers.add(`${stem}_deuk.h`);
        return;
      }
      const structDef = ast.structs.find((s) => s.name === short || s.name === typeStr);
      if (structDef) {
        const stem = structDef.sourceFile ? this.getBaseNameFromSource(structDef.sourceFile) : 'unknown';
        if (stem && stem !== 'unknown' && stem !== baseName) headers.add(`${stem}_deuk.h`);
        return;
      }
      const typedefDef = ast.typedefs?.find((t) => t.name === short || t.name === typeStr);
      if (typedefDef) {
        addFromType(typedefDef.type as DeukPackType);
      }
    };

    const addFromType = (fieldType: DeukPackType) => {
      if (typeof fieldType === 'string') {
        addFromQualifiedType(fieldType);
        return;
      }
      if (typeof fieldType === 'object' && fieldType !== null) {
        const o = fieldType as { type?: string; elementType?: DeukPackType; keyType?: DeukPackType; valueType?: DeukPackType };
        if (o.type === 'list' || o.type === 'set') {
          if (o.elementType) addFromType(o.elementType);
        }
        if (o.type === 'map') {
          if (o.keyType) addFromType(o.keyType);
          if (o.valueType) addFromType(o.valueType);
        }
      }
    };

    for (const s of group.structs) {
      for (const f of s.fields || []) {
        if (typeof f.type === 'string') addFromQualifiedType(f.type);
        else addFromType(f.type as DeukPackType);
      }
    }
    for (const td of group.typedefs) {
      addFromType(td.type as DeukPackType);
    }

    return Array.from(headers).sort();
  }

  private generateHeader(_baseName: string, group: TypeGroup, ast: DeukPackAST, options: GenerationOptions): string | null {
    const lines: string[] = [];
    lines.push(this._tpl.load('HeaderPreamble.h.tpl').trimEnd());
    lines.push('');

    const crossHeaders = this.collectCrossSourceHeaderIncludes(_baseName, group, ast);
    for (const h of crossHeaders) {
      lines.push(`#include "${h}"`);
    }
    if (crossHeaders.length > 0) {
      lines.push('');
    }

    // Group types in this sourceFile by their respective namespaces
    const nsMap: Record<string, TypeGroup> = {};
    const ensureNS = (ns: string) => {
      if (!nsMap[ns]) nsMap[ns] = { enums: [], structs: [], constants: [], typedefs: [] };
    };

    for (const en of group.enums) {
      const ns = this.getEnumNamespace(en, ast);
      ensureNS(ns);
      nsMap[ns]!.enums.push(en);
    }
    for (const st of group.structs) {
      const ns = this.getStructNamespace(st, ast);
      ensureNS(ns);
      nsMap[ns]!.structs.push(st);
    }
    for (const ct of group.constants) {
      const ns = this.getConstantNamespace(ct, ast);
      ensureNS(ns);
      nsMap[ns]!.constants.push(ct);
    }
    for (const td of group.typedefs) {
      const ns = this.getTypedefNamespace(td, ast);
      ensureNS(ns);
      nsMap[ns]!.typedefs.push(td);
    }

    const nsList = Object.keys(nsMap);
    const braceLess = options.braceLessNamespace && nsList.length === 1;

    let emittedDeclaration = false;

    for (const ns of nsList) {
      const defs = nsMap[ns]!;
      
      if (braceLess) {
        lines.push(`// namespace ${ns} (braces omitted per --brace-less-namespace)`);
      } else {
        lines.push(this.renderCppNamespaceOpen(ns));
      }
      lines.push('');

      for (const e of defs.enums) {
        lines.push(this.renderEnum(e).trimEnd());
        lines.push('');
        emittedDeclaration = true;
      }
      for (const s of defs.structs) {
        lines.push(this.renderStructDecl(s, ast, ns).trimEnd());
        lines.push('');
        emittedDeclaration = true;
      }
      for (const td of defs.typedefs) {
        const doc = td.docComment ? `  /** ${td.docComment.replace(/\n/g, ' ')} */\n` : '';
        const cppType = this.getCppType(td.type, ast, ns);
        lines.push(`${doc}  using ${td.name} = ${cppType};`);
        lines.push('');
        emittedDeclaration = true;
      }
      if (defs.constants.length > 0) {
        lines.push('namespace Constants {');
        for (const c of defs.constants) {
          lines.push(this.renderConstantLine(c, ast));
        }
        lines.push('}');
        lines.push('');
        emittedDeclaration = true;
      }

      if (!braceLess) {
        lines.push(this.renderCppNamespaceClose(ns));
        lines.push('');
      }
    }

    if (!emittedDeclaration) {
      return null;
    }

    return lines.join('\n');
  }

  private getEnumNamespace(e: DeukPackEnum, ast: DeukPackAST): string {
    const fromMap = this.lookupFileNamespace(e.sourceFile, ast);
    if (fromMap) return fromMap;
    const sf = e.sourceFile;
    const ns = ast.namespaces.find(
      (n) =>
        (n.language === '*' || n.language === 'cpp') &&
        n.sourceFile &&
        sf &&
        this.normPath(n.sourceFile) === this.normPath(sf)
    );
    return ns?.name ?? 'generated';
  }

  private getStructNamespace(s: DeukPackStruct, ast: DeukPackAST): string {
    const fromMap = this.lookupFileNamespace(s.sourceFile, ast);
    if (fromMap) return fromMap;
    const sf = s.sourceFile;
    const ns = ast.namespaces.find(
      (n) =>
        (n.language === '*' || n.language === 'cpp') &&
        n.sourceFile &&
        sf &&
        this.normPath(n.sourceFile) === this.normPath(sf)
    );
    return ns?.name ?? 'generated';
  }

  private getConstantNamespace(c: DeukPackConstant, ast: DeukPackAST): string {
    const fromMap = this.lookupFileNamespace(c.sourceFile, ast);
    if (fromMap) return fromMap;
    const sf = c.sourceFile;
    const ns = ast.namespaces.find(
      (n) =>
        (n.language === '*' || n.language === 'cpp') &&
        n.sourceFile &&
        sf &&
        this.normPath(n.sourceFile) === this.normPath(sf)
    );
    return ns?.name ?? 'generated';
  }

  private getTypedefNamespace(t: DeukPackTypedef, ast: DeukPackAST): string {
    const fromMap = this.lookupFileNamespace(t.sourceFile, ast);
    if (fromMap) return fromMap;
    const sf = t.sourceFile;
    const ns = ast.namespaces.find(
      (n) =>
        (n.language === '*' || n.language === 'cpp') &&
        n.sourceFile &&
        sf &&
        this.normPath(n.sourceFile) === this.normPath(sf)
    );
    return ns?.name ?? 'generated';
  }

  private renderEnum(e: DeukPackEnum): string {
    const docComment = e.docComment ? `  /** ${e.docComment.replace(/\n/g, ' ')} */\n` : '';
    const entryLines = Object.entries(e.values || {}).map(
      ([k, v], i) => `    ${k} = ${v}${i < Object.keys(e.values || {}).length - 1 ? ',' : ''}`
    );
    return this._tpl.render('CppEnumBlock.h.tpl', {
      DOC_COMMENT: docComment,
      ENUM_NAME: e.name,
      ENUM_ENTRIES: entryLines.join('\n'),
    });
  }

  private renderStructDecl(s: DeukPackStruct, ast: DeukPackAST, currentNs: string): string {
    const docComment = s.docComment ? `  /** ${s.docComment.replace(/\n/g, ' ')} */\n` : '';
    const fieldDeclLines: string[] = [];
    for (const f of s.fields || []) {
      const cppType = typeof f.type === 'string'
        ? this.resolveTypeName(f.type, currentNs, ast)
        : this.getCppType(f.type, ast, currentNs);
      const name = f.name || 'field';
      fieldDeclLines.push(`    ${cppType} ${name}{};`);
    }
    const fieldIdLines: string[] = [];
    for (const f of s.fields || []) {
      const name = f.name || 'field';
      const constName = 'kFieldId_' + name.charAt(0).toUpperCase() + name.slice(1);
      fieldIdLines.push(`    static constexpr int ${constName} = ${f.id};`);
    }
    return this._tpl.render('CppStructDecl.h.tpl', {
      DOC_COMMENT: docComment,
      STRUCT_NAME: s.name,
      FIELD_DECL_LINES: fieldDeclLines.join('\n'),
      FIELD_ID_LINES: fieldIdLines.join('\n'),
    });
  }

  private renderConstantLine(c: DeukPackConstant, ast: DeukPackAST): string {
    const cppType = this.getCppType(c.type as DeukPackType, ast, '');
    const val = c.value;
    let line: string;
    if (cppType === 'std::string') {
      const escaped = typeof val === 'string' ? (val as string).replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
      line = `    inline const std::string ${c.name}{"${escaped}"};`;
    } else {
      let literal = typeof val === 'string' ? `"${(val as string).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : String(val);
      if (cppType === 'int64_t' && typeof val === 'number') literal = `${val}LL`;
      line = `    static constexpr ${cppType} ${c.name} = ${literal};`;
    }
    return this._tpl.render('CppConstantLine.h.tpl', { CONST_LINE: line });
  }

  private generateCppFile(baseName: string, namespaces: string[]): string {
    const nsBlocks = namespaces
      .map((ns) => {
        const open = this.renderCppNamespaceOpen(ns);
        const close = this.renderCppNamespaceClose(ns);
        return `\n${open}\n  // Types defined in header; add serialization implementation if needed.\n${close}\n`;
      })
      .join('');
    return this._tpl.render('TypesCppStub.cpp.tpl', {
      HEADER_FILE: this.cppHeaderFileName(baseName),
      NAMESPACE_BLOCKS: nsBlocks,
    });
  }
}
