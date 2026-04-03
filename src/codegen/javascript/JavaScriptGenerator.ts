/**
 * DeukPack JavaScript generator (Path B: direct JS). Runtime + schema objects.
 */

import { DeukPackAST, DeukPackEnum, DeukPackField, DeukPackStruct, GenerationOptions } from '../../types/DeukPackTypes';
import { CodeGenerator } from '../CodeGenerator';
import { DeukPackCodec } from '../../core/DeukPackCodec';
import { CodegenTemplateHost } from '../codegenTemplateHost';
import { csharpSuffixFromProfile, filterStructFieldsForProfile } from '../WireProfileSubset';
import { buildEmbeddedStructSchema, getEmbeddedSchemaTypeInfo } from '../embeddedStructSchema';

export class JavaScriptGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('javascript');

  async generate(ast: DeukPackAST, options: GenerationOptions): Promise<{ [filename: string]: string }> {
    DeukPackCodec.resolveExtends(ast);

    const lines: string[] = [];
    const preamble = this._tpl.render('JsFilePreamble.js.tpl', {
      ISO_TIMESTAMP: new Date().toISOString(),
    });
    lines.push(preamble.trimEnd());
    lines.push('');
    lines.push(this._tpl.load('JsRuntimeCore.js.tpl').trimEnd());
    lines.push(this._tpl.load('JsPackRuntime.js.tpl').trimEnd());
    lines.push(this._tpl.load('JsBinaryProtocol.js.tpl').trimEnd());
    lines.push('');

    const wireProfilesJs = this.normalizeWireProfiles(options);
    const wireProfileExportNames: string[] = [];

    for (const enumDef of ast.enums || []) {
      lines.push(this.renderJsEnumBlock(enumDef));
      lines.push('');
    }

    for (const struct of ast.structs || []) {
      lines.push(this.renderJsStructFull(struct, ast));
      lines.push('');
    }

    for (const profile of wireProfilesJs) {
      const profileLower = profile.toLowerCase();
      const suffix = csharpSuffixFromProfile(profile);
      for (const struct of ast.structs || []) {
        const filtered = filterStructFieldsForProfile(struct, profileLower);
        if (filtered.length === 0) continue;
        const subsetExportName = struct.name.replace(/\./g, '_') + suffix;
        wireProfileExportNames.push(subsetExportName);
        lines.push(this.renderJsWireProfileStruct(struct, profile, filtered, subsetExportName, ast));
        lines.push('');
      }
    }

    const schemaLines: string[] = [];
    for (const struct of ast.structs || []) {
      const safeName = struct.name.replace(/\./g, '_');
      const qn = this.qualifiedIdlName(struct.name, struct.sourceFile, ast);
      const keys = new Set<string>([struct.name]);
      if (qn !== struct.name) keys.add(qn);
      for (const k of keys) {
        schemaLines.push('_schemas["' + k.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
      }
    }
    for (const profile of wireProfilesJs) {
      const profileLower = profile.toLowerCase();
      const suffix = csharpSuffixFromProfile(profile);
      for (const struct of ast.structs || []) {
        const filtered = filterStructFieldsForProfile(struct, profileLower);
        if (filtered.length === 0) continue;
        const subsetExportName = struct.name.replace(/\./g, '_') + suffix;
        const schemaKey = struct.name + suffix;
        schemaLines.push('_schemas["' + schemaKey.replace(/"/g, '\\"') + '"] = _schema_' + subsetExportName + ';');
      }
    }
    const enumLines: string[] = [];
    for (const enumDef of ast.enums || []) {
      const safeName = enumDef.name.replace(/\./g, '_');
      const qn = this.qualifiedIdlName(enumDef.name, enumDef.sourceFile, ast);
      const keys = new Set<string>([enumDef.name]);
      if (qn !== enumDef.name) keys.add(qn);
      for (const k of keys) {
        enumLines.push('_enums["' + k.replace(/"/g, '\\"') + '"] = _schema_' + safeName + ';');
      }
    }
    lines.push(
      this._tpl.render('JsSchemasRegistration.js.tpl', {
        SCHEMA_LINES: schemaLines.join('\n'),
        ENUM_LINES: enumLines.join('\n'),
      }).trimEnd()
    );
    lines.push('');

    const allNames: string[] = [
      ...(ast.enums || []).map((e) => e.name.replace(/\./g, '_')),
      ...(ast.structs || []).map((s) => s.name.replace(/\./g, '_')),
      ...wireProfileExportNames,
      '_schemas',
      '_enums',
      '_packStructToBinary',
      '_packBinaryToStruct',
      '_structToBinary',
      '_structFromBinary',
      '_toDpJson',
      '_fromDpJson',
      '_wrapDpJson',
      '_unwrapDpJson'
    ];
    const exportLines = allNames.map((n) => '  module.exports.' + n + ' = ' + n + ';').join('\n');
    lines.push(this._tpl.render('JsModuleExports.js.tpl', { EXPORT_LINES: exportLines }).trimEnd());
    lines.push('');

    return { 'generated_deuk.js': lines.join('\n') };
  }

  private normalizeWireProfiles(options: GenerationOptions): string[] {
    const v =
      options.wireProfilesEmit ??
      (options as GenerationOptions & { wireProfiles?: string | string[] }).wireProfiles;
    if (v == null) return [];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  }

  private renderJsEnumBlock(enumDef: DeukPackEnum): string {
    const safeName = enumDef.name.replace(/\./g, '_');
    const schemaObj = {
      name: enumDef.name,
      type: 'enum',
      values: enumDef.values,
      docComment: enumDef.docComment != null ? enumDef.docComment : undefined,
      valueComments:
        enumDef.valueComments && Object.keys(enumDef.valueComments || {}).length
          ? enumDef.valueComments
          : undefined,
      annotations:
        enumDef.annotations && Object.keys(enumDef.annotations || {}).length ? enumDef.annotations : undefined,
    };
    return this._tpl.render('JsEnumBlock.js.tpl', {
      SAFE_NAME: safeName,
      SCHEMA_JSON: JSON.stringify(schemaObj),
    });
  }

  private generateJsReadBinFunction(safeName: string, fieldsToGen: DeukPackField[], ast: DeukPackAST): string {
    const lines: string[] = [];
    lines.push(`function _read_${safeName}_bin(p, schemas) {`);
    lines.push(`  var obj = {};`);
    lines.push(`  if (!p.depth) p.depth = 0; if (++p.depth > 64) throw new Error("Max recursion depth exceeded");`);
    lines.push(`  while (true) {`);
    lines.push(`    var wt = p.view.getUint8(p.off++);`);
    lines.push(`    if (wt === 0) break;`);
    lines.push(`    var id = _jsBinReadI16(p);`);
    lines.push(`    switch (id) {`);
    for (const f of fieldsToGen || []) {
      const ti = getEmbeddedSchemaTypeInfo(f.type, ast);
      lines.push(`      case ${f.id}: obj["${f.name}"] = _jsBinReadValue(p, "${ti.type}", "${ti.typeName}", schemas); break;`);
    }
    lines.push(`      default: _jsBinSkip(p, wt); break;`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`  p.depth--;`);
    for (const f of fieldsToGen || []) {
      if (f.defaultValue !== undefined && f.defaultValue !== null) {
        let dv = f.defaultValue;
        const ti = getEmbeddedSchemaTypeInfo(f.type, ast);
        if (ti.type === 'bool' && typeof dv === 'string') dv = (dv === 'true');
        lines.push(`  if (obj["${f.name}"] === undefined) obj["${f.name}"] = ${JSON.stringify(dv)};`);
      }
    }
    lines.push(`  return obj;`);
    lines.push(`}`);
    return lines.join('\n');
  }

  private generateJsReadPackFunction(safeName: string, fieldsToGen: DeukPackField[], ast: DeukPackAST): string {
    const lines: string[] = [];
    lines.push(`function _read_${safeName}_pack(r, schemas) {`);
    lines.push(`  if (_prU8(r) !== _PackTag.Object) throw new Error("[DeukPack] pack: expected Object tag");`);
    lines.push(`  var cnt = _prI32(r);`);
    lines.push(`  var obj = {};`);
    lines.push(`  for (var i = 0; i < cnt; i++) {`);
    lines.push(`    var key = _prString(r);`);
    lines.push(`    switch (key) {`);
    for (const f of fieldsToGen || []) {
      const ti = getEmbeddedSchemaTypeInfo(f.type, ast);
      lines.push(`      case "${f.name}": obj["${f.name}"] = _packReadValue(r, {type: "${ti.type}", typeName: "${ti.typeName}"}, schemas); break;`);
    }
    lines.push(`      default: _packReadValue(r, null, schemas); break;`);
    lines.push(`    }`);
    lines.push(`  }`);
    for (const f of fieldsToGen || []) {
      if (f.defaultValue !== undefined && f.defaultValue !== null) {
        let dv = f.defaultValue;
        const ti = getEmbeddedSchemaTypeInfo(f.type, ast);
        if (ti.type === 'bool' && typeof dv === 'string') dv = (dv === 'true');
        lines.push(`  if (obj["${f.name}"] === undefined) obj["${f.name}"] = ${JSON.stringify(dv)};`);
      }
    }
    lines.push(`  return obj;`);
    lines.push(`}`);
    return lines.join('\n');
  }

  private renderJsStructFull(struct: DeukPackStruct, ast: DeukPackAST): string {
    const safeName = struct.name.replace(/\./g, '_');
    const schemaObj = buildEmbeddedStructSchema(struct, ast);
    const fieldIdEntries = (struct.fields || []).map((f) => {
      const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      return `${cap}: ${f.id}`;
    });

    const schemaJson = JSON.stringify(schemaObj, (_unusedKey, value) => {
      if (typeof value === 'bigint') {
        return `@@BIGINT@@${value}n`;
      }
      return value;
    }).replace(/"@@BIGINT@@([0-9n\-]+)"/g, '$1');

    const inlineBin = this.generateJsReadBinFunction(safeName, struct.fields || [], ast);
    const inlinePack = this.generateJsReadPackFunction(safeName, struct.fields || [], ast);

    return this._tpl.render('JsStructFull.js.tpl', {
      SAFE_NAME: safeName,
      SCHEMA_JSON: schemaJson,
      FIELD_ID_ENTRIES: fieldIdEntries.join(', '),
      INLINE_BIN: inlineBin,
      INLINE_PACK: inlinePack,
    });
  }

  private normPath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private lookupFileNamespace(sourceFile: string | undefined, ast: DeukPackAST): string | undefined {
    if (!sourceFile || !ast.fileNamespaceMap) return undefined;
    const direct = ast.fileNamespaceMap[sourceFile];
    if (direct) return direct;
    const n = this.normPath(sourceFile);
    const hit = Object.entries(ast.fileNamespaceMap).find(([k]) => this.normPath(k) === n);
    return hit?.[1];
  }

  /** `Hero` + file NS → `deukkits.prologue.Hero`; already-qualified names unchanged. */
  private qualifiedIdlName(shortName: string, sourceFile: string | undefined, ast: DeukPackAST): string {
    if (!shortName) return shortName;
    if (shortName.includes('.')) return shortName;
    const ns = this.lookupFileNamespace(sourceFile, ast);
    return ns ? `${ns}.${shortName}` : shortName;
  }

  private renderJsWireProfileStruct(
    struct: DeukPackStruct,
    profile: string,
    filtered: DeukPackField[],
    subsetExportName: string,
    ast: DeukPackAST
  ): string {
    const schemaObj = {
      ...buildEmbeddedStructSchema({ ...struct, fields: filtered }, ast),
      wireProfile: profile,
    };
    const inlineBin = this.generateJsReadBinFunction(subsetExportName, filtered, ast);
    const inlinePack = this.generateJsReadPackFunction(subsetExportName, filtered, ast);

    return this._tpl.render('JsWireProfileStruct.js.tpl', {
      PROFILE: profile,
      SUBSET_EXPORT_NAME: subsetExportName,
      SCHEMA_JSON: JSON.stringify(schemaObj),
      INLINE_BIN: inlineBin,
      INLINE_PACK: inlinePack,
    });
  }
}
