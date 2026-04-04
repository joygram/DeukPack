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
import { DeukPackCodec } from '../../core/DeukPackCodec';
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
    DeukPackCodec.resolveExtends(ast);
    const fileGroups = this.groupBySourceFile(ast);
    const out: { [filename: string]: string } = {};

    out['DpProtocol.h'] = this._tpl.load('DpProtocol.h.tpl');
    out['DpBinaryProtocol.h'] = this._tpl.load('DpBinaryProtocol.h.tpl');
    out['DpPackProtocol.h'] = this._tpl.load('DpPackProtocol.h.tpl');
    out['DpJsonProtocol.h'] = this._tpl.load('DpJsonProtocol.h.tpl');
    out['DpZeroCopy.h'] = this._tpl.load('DpZeroCopy.h.tpl');

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

      const cppContent = this.generateCppFile(baseName, Array.from(namespaces), group, ast);

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
      out[this.cppSourceFileName(baseName)] = this.generateCppFile(baseName, [], group!, ast);
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
      if (fieldType.type === 'list' || fieldType.type === 'array') {
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
        if (o.type === 'list' || o.type === 'array' || o.type === 'set') {
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
    lines.push('#include "DpProtocol.h"');
    lines.push('#include "DpZeroCopy.h"');
    lines.push('#include <memory>');
    lines.push('#include <vector>');
    lines.push('#include <map>');
    lines.push('#include <set>');
    lines.push('#include <cstring>');
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
      // Topological sort structs
      const sortedStructs: DeukPackStruct[] = [];
      const visited = new Set<string>();
      const temp = new Set<string>();
      const visit = (s: DeukPackStruct) => {
        if (visited.has(s.name)) return;
        if (temp.has(s.name)) return; // circular dependency ignore for now
        temp.add(s.name);
        for (const f of s.fields || []) {
          const tName = typeof f.type === 'string' ? f.type : this.getRealType(f.type, ast);
          const dep = defs.structs.find(x => x.name === tName || x.name === f.type || (f.type as any).elementType === x.name);
          if (dep) visit(dep);
        }
        temp.delete(s.name);
        visited.add(s.name);
        sortedStructs.push(s);
      };
      for (const s of defs.structs) visit(s);
      defs.structs = sortedStructs;

      if (defs.structs.length > 0) {
        for (const s of defs.structs) lines.push(`  struct ${s.name};`);
        lines.push('');
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
      
      // OPTIONAL 필드인 경우 std::optional 도입도 좋지만 현재는 기본값으로 둡니다. 
      // V2에서는 shared_ptr를 완전히 제거하고 직관적인 값(Value) 타입으로 저장합니다.
      fieldDeclLines.push(`  ${cppType} ${name};`);
    }
    const fieldIdLines: string[] = [];
    for (const f of s.fields || []) {
      const name = f.name || 'field';
      const constName = 'kFieldId_' + name.charAt(0).toUpperCase() + name.slice(1);
      fieldIdLines.push(`  static constexpr int ${constName} = ${f.id};`);
    }
    const methods = '  // V2 Zero-Copy Pack ----------------------------------\n' +
      '  size_t GetByteSize() const;\n' +
      '  void WriteDirect(class ZeroCopyWriter& writer) const;\n' +
      '  void ReadDirect(class ZeroCopyReader& reader);\n' +
      '  std::string PackV2() const;\n' +
      '  static ' + s.name + ' UnpackV2(const std::string& data);\n' +
      '  // ----------------------------------------------------';
      
    return `${docComment}struct ${s.name} {\n${fieldDeclLines.join('\n')}\n\n${fieldIdLines.join('\n')}\n\n${methods}\n};`;
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

  private generateCppFile(baseName: string, namespaces: string[], group: TypeGroup, ast: DeukPackAST): string {
    const lines: string[] = [];
    lines.push(`#include "${this.cppHeaderFileName(baseName)}"`);
    lines.push(`#include "DpBinaryProtocol.h"`);
    lines.push(`#include "DpJsonProtocol.h"`);
    lines.push(`#include <sstream>`);
    lines.push('');

    for (const ns of namespaces) {
      lines.push(this.renderCppNamespaceOpen(ns));
      lines.push('');

      for (const s of group.structs) {
        if (this.getStructNamespace(s, ast) === ns) {
            lines.push(this.renderStructImpl(s, ast, ns));
            lines.push('');
        }
      }

      lines.push(this.renderCppNamespaceClose(ns));
      lines.push('');
    }
    return lines.join('\n');
  }

  private renderStructImpl(s: DeukPackStruct, ast: DeukPackAST, _ns: string): string {
    const name = s.name;
    const fields = s.fields || [];

    // [V2] GetByteSize Method
    let sizeLines = fields.map(f => {
      const type = f.type;
      const t = this.getRealType(type, ast);
      let condition = ``;
      if (t === 'string' || t === 'binary' || t === 'list' || t === 'array' || t === 'set' || t === 'map') {
        condition = `!${f.name}.empty()`;
      } else {
        condition = `true`; // for primitives, just write always in this V2 poc unless we want to check zero
      }
      
      let sizeStmts = ``;
      if (t === 'string' || t === 'binary') sizeStmts = `size += 4 + ${f.name}.length();`;
      else if (t === 'bool' || t === 'byte' || t === 'int8') sizeStmts = `size += 1;`;
      else if (t === 'int16') sizeStmts = `size += 2;`;
      else if (t === 'int32' || t === 'enum' || t === 'float') sizeStmts = `size += 4;`;
      else if (t === 'int64' || t === 'double') sizeStmts = `size += 8;`;
      else if (t === 'record') sizeStmts = `size += ${f.name}.GetByteSize();`;
      else if (t === 'list' || t === 'array' || t === 'set') {
        const et = (type as any).elementType;
        const eType = this.getRealType(et, ast);
        let eSize = `4`;
        if (eType === 'int64' || eType === 'double') eSize = `8`;
        else if (eType === 'bool' || eType === 'byte' || eType === 'int8') eSize = `1`;
        else if (eType === 'int16') eSize = `2`;
        else if (eType === 'string' || eType === 'binary') eSize = `4 + elem.length()`;
        else if (eType === 'record') eSize = `elem.GetByteSize()`;
        
        sizeStmts = `size += 1 + 4;\n    for (const auto elem : ${f.name}) { size += ${eSize}; }`;
      } else if (t === 'map') {
        const kt = (type as any).keyType;
        const vt = (type as any).valueType;
        const kType = this.getRealType(kt, ast);
        const vType = this.getRealType(vt, ast);
        
        let kSize = `4`;
        if (kType === 'string' || kType === 'binary') kSize = `4 + kv.first.length()`;
        else if (kType === 'int64' || kType === 'double') kSize = `8`;

        let vSize = `4`;
        if (vType === 'string' || vType === 'binary') vSize = `4 + kv.second.length()`;
        else if (vType === 'int64' || vType === 'double') vSize = `8`;
        else if (vType === 'record') vSize = `kv.second.GetByteSize()`;

        sizeStmts = `size += 1 + 1 + 4;\n    for (const auto& kv : ${f.name}) { size += ${kSize}; size += ${vSize}; }`;
      } else {
        sizeStmts = `size += 0; /* unsupported size */`;
      }

      if (condition === 'true') {
        return `  size += 1 + 2; // FieldBegin\n  ${sizeStmts}`;
      } else {
        return `  if (${condition}) {\n    size += 1 + 2;\n    ${sizeStmts}\n  }`;
      }
    }).join('\n');

    // [V2] WriteDirect Method
    let writeLines = fields.map(f => {
      const type = f.type;
      const t = this.getRealType(type, ast);
       let condition = ``;
      if (t === 'string' || t === 'binary' || t === 'list' || t === 'array' || t === 'set' || t === 'map') {
        condition = `!${f.name}.empty()`;
      } else {
        condition = `true`; 
      }

      let writeOp = ``;
      if (t === 'string' || t === 'binary') writeOp = `writer.WriteString(${f.name});`;
      else if (t === 'bool') writeOp = `writer.WriteByte(${f.name} ? 1 : 0);`;
      else if (t === 'byte' || t === 'int8') writeOp = `writer.WriteByte(${f.name});`;
      else if (t === 'int16') writeOp = `writer.WriteI16(${f.name});`;
      else if (t === 'int32' || t === 'enum') writeOp = `writer.WriteI32(static_cast<int32_t>(${f.name}));`;
      else if (t === 'int64') writeOp = `writer.WriteI64(${f.name});`;
      else if (t === 'float') writeOp = `writer.WriteI32(*(reinterpret_cast<const int32_t*>(&${f.name}))); /* fixme proper float */`;
      else if (t === 'double') writeOp = `writer.WriteI64(*(reinterpret_cast<const int64_t*>(&${f.name}))); /* fixme proper double */`;
      else if (t === 'record') writeOp = `${f.name}.WriteDirect(writer);`;
      else if (t === 'list' || t === 'array' || t === 'set') {
        const et = (type as any).elementType;
        const eType = this.getRealType(et, ast);
        let eWrite = `writer.WriteI32(static_cast<int32_t>(elem));`;
        if (eType === 'string' || eType === 'binary') eWrite = `writer.WriteString(elem);`;
        else if (eType === 'int64' || eType === 'double') eWrite = `writer.WriteI64(elem);`;
        else if (eType === 'record') eWrite = `elem.WriteDirect(writer);`;
        
        const b = t === 'set' ? 'WriteSetBegin' : 'WriteListBegin';
        writeOp = `writer.${b}(static_cast<uint8_t>(deuk::DpWireType::${this.toWireType(et, ast)}), static_cast<int32_t>(${f.name}.size()));\n` +
                  `    for (const auto elem : ${f.name}) { ${eWrite} }`;
      } else if (t === 'map') {
          const kt = (type as any).keyType;
          const vt = (type as any).valueType;
          const kType = this.getRealType(kt, ast);
          const vType = this.getRealType(vt, ast);
          
          let kWrite = `writer.WriteI32(static_cast<int32_t>(kv.first));`;
          if (kType === 'string' || kType === 'binary') kWrite = `writer.WriteString(kv.first);`;
          else if (kType === 'int64' || kType === 'double') kWrite = `writer.WriteI64(kv.first);`;
          
          let vWrite = `writer.WriteI32(static_cast<int32_t>(kv.second));`;
          if (vType === 'string' || vType === 'binary') vWrite = `writer.WriteString(kv.second);`;
          else if (vType === 'int64' || vType === 'double') vWrite = `writer.WriteI64(kv.second);`;
          else if (vType === 'record') vWrite = `kv.second.WriteDirect(writer);`;
          
          writeOp = `writer.WriteMapBegin(static_cast<uint8_t>(deuk::DpWireType::${this.toWireType(kt, ast)}), static_cast<uint8_t>(deuk::DpWireType::${this.toWireType(vt, ast)}), static_cast<int32_t>(${f.name}.size()));\n` +
                    `    for (const auto& kv : ${f.name}) { ${kWrite} ${vWrite} }`;
      } else {
        writeOp = `// TODO Write Op: ${t}`;
      }

      if (condition === 'true') {
        return `  writer.WriteFieldBegin(static_cast<uint8_t>(deuk::DpWireType::${this.toWireType(type, ast)}), ${f.id});\n  ${writeOp}`;
      } else {
        return `  if (${condition}) {\n    writer.WriteFieldBegin(static_cast<uint8_t>(deuk::DpWireType::${this.toWireType(type, ast)}), ${f.id});\n    ${writeOp}\n  }`;
      }
    }).join('\n');

    return `size_t ${name}::GetByteSize() const {\n` +
           `  size_t size = 0;\n` +
           `${sizeLines}\n` +
           `  size += 1; // FieldStop\n` +
           `  return size;\n` +
           `}\n\n` +
           `void ${name}::WriteDirect(ZeroCopyWriter& writer) const {\n` +
           `${writeLines}\n` +
           `  writer.WriteFieldStop();\n` +
           `}\n\n` +
           `void ${name}::ReadDirect(ZeroCopyReader& reader) {\n` +
           `  while (true) {\n` +
           `    uint8_t f_type; int16_t f_id;\n` +
           `    if (!reader.ReadFieldBegin(f_type, f_id)) break;\n` +
           `    switch (f_id) {\n` +
           `${this.renderReadDirectCases(s, ast)}\n` +
           `      default:\n` +
           `        reader.Skip(f_type);\n` +
           `        break;\n` +
           `    }\n` +
           `  }\n` +
           `}\n\n` +
           `std::string ${name}::PackV2() const {\n` +
           `  size_t total_size = GetByteSize();\n` +
           `  std::string buf;\n` +
           `  buf.resize(total_size);\n` +
           `  ZeroCopyWriter writer(reinterpret_cast<uint8_t*>(&buf[0]));\n` +
           `  WriteDirect(writer);\n` +
           `  return buf;\n` +
           `}\n\n` +
           `${name} ${name}::UnpackV2(const std::string& data) {\n` +
           `  ${name} obj;\n` +
           `  ZeroCopyReader reader(reinterpret_cast<const uint8_t*>(data.data()), data.length());\n` +
           `  obj.ReadDirect(reader);\n` +
           `  return obj;\n` +
           `}`;
  }

  private renderReadDirectCases(s: DeukPackStruct, ast: DeukPackAST): string {
    const lines: string[] = [];
    for (const f of s.fields || []) {
      const type = f.type;
      const t = this.getRealType(type, ast);
      
      let readOp = `// TODO Read Op: ${t}`;
      if (t === 'string' || t === 'binary') readOp = `${f.name} = reader.ReadString();`;
      else if (t === 'bool') readOp = `${f.name} = (reader.ReadByte() != 0);`;
      else if (t === 'byte' || t === 'int8') readOp = `${f.name} = reader.ReadByte();`;
      else if (t === 'int16') readOp = `${f.name} = reader.ReadI16();`;
      else if (t === 'int32') readOp = `${f.name} = reader.ReadI32();`;
      else if (t === 'enum') readOp = `${f.name} = static_cast<${this.getCppType(type, ast, '')}>(reader.ReadI32());`;
      else if (t === 'int64') readOp = `${f.name} = reader.ReadI64();`;
      else if (t === 'float') {
          // bit_cast via union for simple impl
          readOp = `int32_t __fi32_${f.id} = reader.ReadI32();\n        ${f.name} = *(reinterpret_cast<const float*>(&__fi32_${f.id})); /* fixme proper float */`;
      }
      else if (t === 'double') readOp = `${f.name} = reader.ReadDouble();`;
      else if (t === 'record') readOp = `${f.name}.ReadDirect(reader);`;
      else if (t === 'list' || t === 'array' || t === 'set') {
        const et = (type as any).elementType;
        const eType = this.getRealType(et, ast);
        
        let eRead = `reader.ReadI32()`;
        if (eType === 'string' || eType === 'binary') eRead = `reader.ReadString()`;
        else if (eType === 'int64' || eType === 'double') eRead = `reader.ReadI64()`;
        else if (eType === 'bool') eRead = `(reader.ReadByte() != 0)`;
        else if (eType === 'int16') eRead = `reader.ReadI16()`;
        else if (eType === 'byte' || eType === 'int8') eRead = `reader.ReadByte()`;
        else if (eType === 'enum') eRead = `static_cast<${this.getCppType(et, ast, '')}>(reader.ReadI32())`;
        else if (eType === 'record') eRead = `[&]() -> decltype(${f.name})::value_type { decltype(${f.name})::value_type v; v.ReadDirect(reader); return v; }()`;

        const b = t === 'set' ? 'ReadSetBegin' : 'ReadListBegin';
        const ins = t === 'set' ? 'insert' : 'push_back';
        
        readOp = `uint8_t __et_${f.id}; int32_t __c_${f.id};\n` +
                 `        reader.${b}(__et_${f.id}, __c_${f.id});\n` +
                 (t !== 'set' ? `        ${f.name}.reserve(__c_${f.id});\n` : ``) +
                 `        for (int32_t i=0; i<__c_${f.id}; ++i) { ${f.name}.${ins}(${eRead}); }`;
      } else if (t === 'map') {
        const kt = (type as any).keyType;
        const vt = (type as any).valueType;
        const kType = this.getRealType(kt, ast);
        const vType = this.getRealType(vt, ast);
        
        let kRead = `reader.ReadI32()`;
        if (kType === 'string' || kType === 'binary') kRead = `reader.ReadString()`;
        else if (kType === 'int64' || kType === 'double') kRead = `reader.ReadI64()`;
        else if (kType === 'enum') kRead = `static_cast<${this.getCppType(kt, ast, '')}>(reader.ReadI32())`;

        let vRead = `reader.ReadI32()`;
        if (vType === 'string' || vType === 'binary') vRead = `reader.ReadString()`;
        else if (vType === 'int64' || vType === 'double') vRead = `reader.ReadI64()`;
        else if (vType === 'bool') vRead = `(reader.ReadByte() != 0)`;
        else if (vType === 'int16') vRead = `reader.ReadI16()`;
        else if (vType === 'byte' || vType === 'int8') vRead = `reader.ReadByte()`;
        else if (vType === 'enum') vRead = `static_cast<${this.getCppType(vt, ast, '')}>(reader.ReadI32())`;
        else if (vType === 'record') vRead = `[&]() -> decltype(${f.name})::mapped_type { decltype(${f.name})::mapped_type v; v.ReadDirect(reader); return v; }()`;

        readOp = `uint8_t __kt_${f.id}; uint8_t __vt_${f.id}; int32_t __c_${f.id};\n` +
                 `        reader.ReadMapBegin(__kt_${f.id}, __vt_${f.id}, __c_${f.id});\n` +
                 `        for (int32_t i=0; i<__c_${f.id}; ++i) {\n` +
                 `          auto __k = ${kRead};\n` +
                 `          auto __v = ${vRead};\n` +
                 `          ${f.name}[__k] = __v;\n` +
                 `        }`;
      }
      
      lines.push(`      case ${f.id}: {`);
      lines.push(`        ${readOp}`);
      lines.push(`        break;`);
      lines.push(`      }`);
    }
    return lines.join('\n');
  }

  private getRealType(type: DeukPackType, ast: DeukPackAST): string {
    if (typeof type !== 'string') return type.type;
    const primitives = ['bool', 'byte', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'double', 'string', 'binary'];
    if (primitives.includes(type)) return type;
    if (ast.enums.some(e => e.name === type || type.endsWith('.' + e.name))) return 'enum';
    if (ast.structs.some(s => s.name === type || type.endsWith('.' + s.name))) return 'record';
    return 'record';
  }

  private toWireType(type: DeukPackType, ast: DeukPackAST): string {
    const t = this.getRealType(type, ast);
    switch (t) {
        case 'bool': return 'Bool';
        case 'byte': case 'int8': return 'Byte';
        case 'int16': return 'Int16';
        case 'int32': return 'Int32';
        case 'int64': return 'Int64';
        case 'float': case 'double': return 'Double';
        case 'string': return 'String';
        case 'binary': return 'String';
        case 'record': return 'Struct';
        case 'enum': return 'Int32';
        case 'list': case 'array': return 'List';
        case 'set': return 'Set';
        case 'map': return 'Map';
        default: return 'Void';
    }
  }


}
