/**
 * DeukPack C++ Generator
 * Output: one _types.h and one _types.cpp per source file (namespace), like C# file split.
 */

import {
  DeukPackAST,
  GenerationOptions,
  DeukPackStruct,
  DeukPackEnum,
  DeukPackConstant,
  DeukPackType,
} from '../types/DeukPackTypes';
import { CodeGenerator } from './CodeGenerator';
import { DeukPackEngine } from '../core/DeukPackEngine';

type TypeGroup = {
  enums: DeukPackEnum[];
  structs: DeukPackStruct[];
  constants: DeukPackConstant[];
};

export class CppGenerator extends CodeGenerator {
  async generate(ast: DeukPackAST, _options: GenerationOptions): Promise<{ [filename: string]: string }> {
    DeukPackEngine.resolveExtends(ast);
    const fileGroups = this.groupBySourceFile(ast);
    const out: { [filename: string]: string } = {};

    for (const [sourceFile, group] of Object.entries(fileGroups)) {
      const ns = this.getNamespaceForFile(sourceFile, ast);
      const baseName = this.getBaseNameFromSource(sourceFile);
      if (!baseName || baseName === 'unknown') continue;

      const hContent = this.generateHeader(baseName, ns, group, ast);
      const cppContent = this.generateCpp(baseName, ns);

      out[`${baseName}_types.h`] = hContent;
      out[`${baseName}_types.cpp`] = cppContent;
    }

    return out;
  }

  private groupBySourceFile(ast: DeukPackAST): { [sourceFile: string]: TypeGroup } {
    const groups: { [sourceFile: string]: TypeGroup } = {};
    const ensure = (sourceFile: string) => {
      if (!groups[sourceFile]) {
        groups[sourceFile] = { enums: [], structs: [], constants: [] };
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
    return groups;
  }

  private getBaseNameFromSource(sourceFile: string): string {
    const filename = sourceFile.split('/').pop()?.split('\\').pop() || 'unknown';
    const nameWithoutExt = filename.replace(/\.thrift$/i, '').replace(/\.deuk$/i, '');
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
    if (reserved.includes(nameWithoutExt.toUpperCase()) || !nameWithoutExt) return 'unknown';
    return nameWithoutExt;
  }

  private getNamespaceForFile(sourceFile: string, ast: DeukPackAST): string {
    if (ast.fileNamespaceMap?.[sourceFile]) return ast.fileNamespaceMap[sourceFile];
    const ns = ast.namespaces.find(
      (n) => (n.language === '*' || n.language === 'cpp') && (n.sourceFile === sourceFile || !n.sourceFile)
    );
    return ns?.name ?? 'generated';
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
      const ns = (enumDef.sourceFile && ast.fileNamespaceMap?.[enumDef.sourceFile])
        ? ast.fileNamespaceMap[enumDef.sourceFile]
        : currentNs;
      return ns === currentNs ? short : `${ns}::${short}`;
    }
    const structDef = ast.structs.find((s) => s.name === short || s.name === typeStr);
    if (structDef) {
      const ns = (structDef.sourceFile && ast.fileNamespaceMap?.[structDef.sourceFile])
        ? ast.fileNamespaceMap[structDef.sourceFile]
        : currentNs;
      return ns === currentNs ? short : `${ns}::${short}`;
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
      bool: 'bool', byte: 'int8_t', i8: 'int8_t', int8: 'int8_t',
      i16: 'int16_t', int16: 'int16_t', i32: 'int32_t', int32: 'int32_t',
      i64: 'int64_t', int64: 'int64_t',
      uint8: 'uint8_t', uint16: 'uint16_t', uint32: 'uint32_t', uint64: 'uint64_t',
      float: 'float', double: 'double',
      string: 'std::string', binary: 'std::string',
    };
    return map[typeStr] ?? null;
  }

  private generateHeader(_baseName: string, ns: string, group: TypeGroup, ast: DeukPackAST): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(' * Autogenerated by DeukPack v1.0.0');
    lines.push(' * DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING');
    lines.push(' * @generated');
    lines.push(' */');
    lines.push('#pragma once');
    lines.push('#include <cstdint>');
    lines.push('#include <string>');
    lines.push('#include <vector>');
    lines.push('#include <map>');
    lines.push('#include <set>');
    lines.push('#include <any>');
    lines.push('#include <unordered_map>');
    lines.push('');
    lines.push(`namespace ${ns} {`);
    lines.push('');

    for (const e of group.enums) {
      lines.push(...this.emitEnum(e));
      lines.push('');
    }
    for (const s of group.structs) {
      lines.push(...this.emitStructDecl(s, ast, ns));
      lines.push('');
    }
    if (group.constants.length > 0) {
      lines.push('namespace Constants {');
      for (const c of group.constants) {
        lines.push(...this.emitConstant(c, ast));
      }
      lines.push('}');
      lines.push('');
    }

    lines.push('} // namespace ' + ns);
    lines.push('');
    return lines.join('\n');
  }

  private emitEnum(e: DeukPackEnum): string[] {
    const lines: string[] = [];
    if (e.docComment) lines.push(`  /** ${e.docComment.replace(/\n/g, ' ')} */`);
    lines.push(`  enum class ${e.name} {`);
    const entries = Object.entries(e.values || {});
    entries.forEach(([k, v], i) => {
      const comma = i < entries.length - 1 ? ',' : '';
      lines.push(`    ${k} = ${v}${comma}`);
    });
    lines.push('  };');
    return lines;
  }

  private emitStructDecl(s: DeukPackStruct, ast: DeukPackAST, currentNs: string): string[] {
    const lines: string[] = [];
    if (s.docComment) lines.push(`  /** ${s.docComment.replace(/\n/g, ' ')} */`);
    lines.push(`  struct ${s.name} {`);
    for (const f of s.fields || []) {
      const cppType = typeof f.type === 'string'
        ? this.resolveTypeName(f.type, currentNs, ast)
        : this.getCppType(f.type, ast, currentNs);
      const name = f.name || 'field';
      lines.push(`    ${cppType} ${name}{};`);
    }
    lines.push('');
    for (const f of s.fields || []) {
      const name = f.name || 'field';
      const constName = 'kFieldId_' + name.charAt(0).toUpperCase() + name.slice(1);
      lines.push(`    static constexpr int ${constName} = ${f.id};`);
    }
    lines.push('');
    lines.push(`    /** Apply per-field overrides (field id -> std::any). */`);
    lines.push(`    void apply_overrides(const std::unordered_map<int, std::any>& overrides) {`);
    for (const f of s.fields || []) {
      const cppType = typeof f.type === 'string'
        ? this.resolveTypeName(f.type, currentNs, ast)
        : this.getCppType(f.type, ast, currentNs);
      const name = f.name || 'field';
      lines.push(`      { auto it = overrides.find(${f.id}); if (it != overrides.end()) ${name} = std::any_cast<${cppType}>(it->second); }`);
    }
    lines.push(`    }`);
    lines.push('  };');
    return lines;
  }

  private emitConstant(c: DeukPackConstant, ast: DeukPackAST): string[] {
    const cppType = this.getCppType(c.type as DeukPackType, ast, '');
    const val = c.value;
    if (cppType === 'std::string') {
      const escaped = typeof val === 'string' ? val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
      return [`    inline const std::string ${c.name}{"${escaped}"};`];
    }
    let literal = typeof val === 'string' ? `"${(val as string).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : String(val);
    if (cppType === 'int64_t' && typeof val === 'number') literal = `${val}LL`;
    return [`    static constexpr ${cppType} ${c.name} = ${literal};`];
  }

  private generateCpp(baseName: string, ns: string): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(' * Autogenerated by DeukPack v1.0.0');
    lines.push(' * @generated');
    lines.push(' */');
    lines.push(`#include "${baseName}_types.h"`);
    lines.push('');
    lines.push(`namespace ${ns} {`);
    lines.push('  // Types defined in header; add serialization here if needed.');
    lines.push('} // namespace ' + ns);
    lines.push('');
    return lines.join('\n');
  }
}
