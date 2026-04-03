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
  DeukPackField,
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
    lines.push('#include <memory>');
    lines.push('#include <vector>');
    lines.push('#include <map>');
    lines.push('#include <set>');
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
      fieldDeclLines.push(`  std::shared_ptr<${cppType}> ${name};`);
    }
    const fieldIdLines: string[] = [];
    for (const f of s.fields || []) {
      const name = f.name || 'field';
      const constName = 'kFieldId_' + name.charAt(0).toUpperCase() + name.slice(1);
      fieldIdLines.push(`  static constexpr int ${constName} = ${f.id};`);
    }
    return this._tpl.render('CppStructDecl.h.tpl', {
      DOC_COMMENT: docComment,
      STRUCT_NAME: s.name,
      FIELD_DECL_LINES: fieldDeclLines.join('\n'),
      FIELD_ID_LINES: fieldIdLines.join('\n') + '\n\n  // Unified DeukPack Serialization API\n' +
      '  std::string Pack(const std::string& format = "") const;\n' +
      '  static std::string Pack(const ' + s.name + '& obj, const std::string& format = "");\n' +
      '  /**\n' +
      '   * Deserializes data and returns it by value (RVO).\n' +
      '   * High performance for stack allocation, but deep containers (std::vector) will allocate on the heap.\n' +
      '   */\n' +
      '  static ' + s.name + ' Unpack(const std::string& buf, const std::string& format = "");\n' +
      '  /**\n' +
      '   * Deserializes data into an existing instance (Zero-Allocation Overwrite).\n' +
      '   * Clears and reuses existing std::vector capacity, avoiding expensive OS heap allocator mutex locks.\n' +
      '   */\n' +
      '  static void Unpack(' + s.name + '& obj, const std::string& buf, const std::string& format = "");',
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

  private renderStructImpl(s: DeukPackStruct, ast: DeukPackAST, ns: string): string {
    const name = s.name;
    const fields = s.fields || [];

    // Write method
    const nonNullCount = fields.map(f => `(${f.name} ? 1 : 0)`).join(' + ');
    const writeLines = fields.map(f => {
        return `    if (${f.name}) {\n` +
               `      oprot.WriteFieldBegin({"${f.name}", DpWireType::${this.toWireType(f.type, ast)}, ${f.id}});\n` +
               `      ${this.renderWriteCall(f, f.name, ast)}\n` +
               `      oprot.WriteFieldEnd();\n` +
               `    }`;
    }).join('\n');

    // Read method
    const readSwitchCases = fields.map(f => {
        return `      case ${f.id}:\n` +
               `        if (field.Type == DpWireType::${this.toWireType(f.type, ast)} || field.Type == DpWireType::Void) {\n` +
               `          ${this.renderReadCall(f, f.name, ast, ns)}\n` +
               `        } else {\n` +
               `          iprot.Skip(field.Type);\n` +
               `        }\n` +
               `        break;`;
    }).join('\n');

    const nameToIdLogic = fields.map(f => 
        `    if (id == 0 && field.Name == "${f.name}") id = ${f.id};`
    ).join('\n');

    return `void ${name}::Write(DpProtocol& oprot) const {\n` +
           `  oprot.WriteStructBegin({"${name}", ${nonNullCount || '0'}});\n` +
           `${writeLines}\n` +
           `  oprot.WriteFieldStop();\n` +
           `  oprot.WriteStructEnd();\n` +
           `}\n\n` +
           `void ${name}::Read(DpProtocol& iprot) {\n` +
           `  iprot.ReadStructBegin();\n` +
           `  while (true) {\n` +
           `    DpColumn field = iprot.ReadFieldBegin();\n` +
           `    if (field.Type == DpWireType::Stop) break;\n` +
           `    int16 id = field.ID;\n` +
           `${nameToIdLogic}\n` +
           `    switch (id) {\n` +
           `${readSwitchCases}\n` +
           `      default: iprot.Skip(field.Type); break;\n` +
           `    }\n` +
           `    iprot.ReadFieldEnd();\n` +
           `  }\n` +
           `  iprot.ReadStructEnd();\n` +
           `}\n\n` +
           `std::string ${name}::Pack(const std::string& format) const {\n` +
           `  std::ostringstream ss;\n` +
           `  if (format == \"json\") { deuk::DpJsonProtocol prot(&ss); Write(prot); }\n` +
           `  else { deuk::DpBinaryProtocol prot(&ss); Write(prot); }\n` +
           `  return ss.str();\n` +
           `}\n\n` +
           `std::string ${name}::Pack(const ${name}& obj, const std::string& format) { return obj.Pack(format); }\n\n` +
           `${name} ${name}::Unpack(const std::string& buf, const std::string& format) {\n` +
           `  ${name} obj; Unpack(obj, buf, format); return obj;\n` +
           `}\n\n` +
           `void ${name}::Unpack(${name}& obj, const std::string& buf, const std::string& format) {\n` +
           `  std::istringstream ss(buf);\n` +
           `  if (format == \"json\") { deuk::DpJsonProtocol prot(&ss); obj.Read(prot); }\n` +
           `  else { deuk::DpBinaryProtocol prot(&ss); obj.Read(prot); }\n` +
           `}`;
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

  private renderWriteCall(f: DeukPackField, varName: string, ast: DeukPackAST): string {
    const type = f.type;
    const t = this.getRealType(type, ast);
    switch (t) {
        case 'bool': return `oprot.WriteBool(*${varName});`;
        case 'byte': case 'int8': return `oprot.WriteByte(*${varName});`;
        case 'int16': return `oprot.WriteI16(*${varName});`;
        case 'int32': return `oprot.WriteI32(*${varName});`;
        case 'int64': return `oprot.WriteI64(*${varName});`;
        case 'float': case 'double': return `oprot.WriteDouble(*${varName});`;
        case 'string': return `oprot.WriteString(*${varName});`;
        case 'binary': return `oprot.WriteBinary(*${varName});`;
        case 'record': return `${varName}->Write(oprot);`;
        case 'enum': return `oprot.WriteI32(static_cast<deuk::int32>(*${varName}));`;
        case 'list': case 'array': case 'set': {
            const et = (type as any).elementType;
            const etWire = this.toWireType(et, ast);
            const isSet = t === 'set';
            const begin = isSet ? 'WriteSetBegin' : 'WriteListBegin';
            const end = isSet ? 'WriteSetEnd' : 'WriteListEnd';
            return `oprot.${begin}({DpWireType::${etWire}, static_cast<deuk::int32>(${varName}->size())});\n` +
                   `      for (const auto& elem : *${varName}) {\n` +
                   `        ${this.renderWriteValueOnly(et, 'elem', ast)}\n` +
                   `      }\n` +
                   `      oprot.${end}();`;
        }
        case 'map': {
            const kt = (type as any).keyType;
            const vt = (type as any).valueType;
            return `oprot.WriteMapBegin({DpWireType::${this.toWireType(kt, ast)}, DpWireType::${this.toWireType(vt, ast)}, static_cast<deuk::int32>(${varName}->size())});\n` +
                   `      for (const auto& kv : *${varName}) {\n` +
                   `        ${this.renderWriteValueOnly(kt, 'kv.first', ast)}\n` +
                   `        ${this.renderWriteValueOnly(vt, 'kv.second', ast)}\n` +
                   `      }\n` +
                   `      oprot.WriteMapEnd();`;
        }
        default: return `// TODO: ${t}`;
    }
  }

  private renderWriteValueOnly(type: DeukPackType, varName: string, ast: DeukPackAST): string {
    const t = this.getRealType(type, ast);
    switch (t) {
        case 'bool': return `oprot.WriteBool(${varName});`;
        case 'byte': case 'int8': return `oprot.WriteByte(${varName});`;
        case 'int16': return `oprot.WriteI16(${varName});`;
        case 'int32': return `oprot.WriteI32(${varName});`;
        case 'int64': return `oprot.WriteI64(${varName});`;
        case 'float': case 'double': return `oprot.WriteDouble(${varName});`;
        case 'string': return `oprot.WriteString(${varName});`;
        case 'binary': return `oprot.WriteBinary(${varName});`;
        case 'record': return `${varName}.Write(oprot);`;
        case 'enum': return `oprot.WriteI32(static_cast<deuk::int32>(${varName}));`;
        default: return `// TODO: ${t}`;
    }
  }

  private renderReadCall(f: DeukPackField, varName: string, ast: DeukPackAST, currentNs: string): string {
    const type = f.type;
    const t = this.getRealType(type, ast);
    const cppType = typeof type === 'string' ? this.resolveTypeName(type, currentNs, ast) : this.getCppType(type, ast, currentNs);
    
    switch (t) {
        case 'bool': return `${varName} = std::make_shared<bool>(iprot.ReadBool());`;
        case 'byte': case 'int8': return `${varName} = std::make_shared<deuk::int8>(iprot.ReadByte());`;
        case 'int16': return `${varName} = std::make_shared<deuk::int16>(iprot.ReadI16());`;
        case 'int32': return `${varName} = std::make_shared<deuk::int32>(iprot.ReadI32());`;
        case 'int64': return `${varName} = std::make_shared<deuk::int64>(iprot.ReadI64());`;
        case 'float': return `${varName} = std::make_shared<deuk::float32>(static_cast<deuk::float32>(iprot.ReadDouble()));`;
        case 'double': return `${varName} = std::make_shared<deuk::float64>(iprot.ReadDouble());`;
        case 'string': return `${varName} = std::make_shared<std::string>(iprot.ReadString());`;
        case 'binary': return `${varName} = std::make_shared<std::string>(iprot.ReadBinary());`;
        case 'enum': return `${varName} = std::make_shared<${cppType}>(static_cast<${cppType}>(iprot.ReadI32()));`;
        case 'record': return `${varName} = std::make_shared<${cppType}>();\n          ${varName}->Read(iprot);`;
        case 'list': case 'array': case 'set': {
            const et = (type as any).elementType;
            const isSet = t === 'set';
            const begin = isSet ? 'ReadSetBegin' : 'ReadListBegin';
            const end = isSet ? 'ReadSetEnd' : 'ReadListEnd';
            return `${varName} = std::make_shared<${cppType}>();\n` +
                   `          auto info = iprot.${begin}();\n` +
                   `          for (int32 i = 0; i < info.Count; ++i) {\n` +
                   `            ${varName}->${isSet ? 'insert' : 'push_back'}(${this.renderReadValueOnly(et, ast, currentNs)});\n` +
                   `          }\n` +
                   `          iprot.${end}();`;
        }
        case 'map': {
            const kt = (type as any).keyType;
            const vt = (type as any).valueType;
            return `${varName} = std::make_shared<${cppType}>();\n` +
                   `          auto info = iprot.ReadMapBegin();\n` +
                   `          for (int32 i = 0; i < info.Count; ++i) {\n` +
                   `            auto key = ${this.renderReadValueOnly(kt, ast, currentNs)};\n` +
                   `            auto val = ${this.renderReadValueOnly(vt, ast, currentNs)};\n` +
                   `            (*${varName})[key] = val;\n` +
                   `          }\n` +
                   `          iprot.ReadMapEnd();`;
        }
        default: return `// TODO: ${t}`;
    }
  }

  private renderReadValueOnly(type: DeukPackType, ast: DeukPackAST, currentNs: string): string {
    const t = this.getRealType(type, ast);
    const cppType = typeof type === 'string' ? this.resolveTypeName(type, currentNs, ast) : this.getCppType(type, ast, currentNs);
    switch (t) {
        case 'bool': return `iprot.ReadBool()`;
        case 'byte': case 'int8': return `iprot.ReadByte()`;
        case 'int16': return `iprot.ReadI16()`;
        case 'int32': return `iprot.ReadI32()`;
        case 'int64': return `iprot.ReadI64()`;
        case 'float': return `static_cast<deuk::float32>(iprot.ReadDouble())`;
        case 'double': return `iprot.ReadDouble()`;
        case 'string': return `iprot.ReadString()`;
        case 'binary': return `iprot.ReadBinary()`;
        case 'record': return `[] (DpProtocol& ip) { ${cppType} v; v.Read(ip); return v; }(iprot)`;
        case 'enum': return `static_cast<${cppType}>(iprot.ReadI32())`;
        default: return `/* TODO: ${t} */ {}`;
    }
  }
}
