/**
 * DeukPack JavaScript generator (Path B: direct JS). Runtime + schema objects.
 */

import { DeukPackAST, DeukPackEnum, DeukPackField, DeukPackStruct, GenerationOptions } from '../../types/DeukPackTypes';
import { CodeGenerator } from '../CodeGenerator';
import { DeukPackEngine } from '../../core/DeukPackEngine';
import { CodegenTemplateHost } from '../codegenTemplateHost';
import { csharpSuffixFromProfile, filterStructFieldsForProfile } from '../WireProfileSubset';
import { buildEmbeddedStructSchema } from '../embeddedStructSchema';

export class JavaScriptGenerator extends CodeGenerator {
  private readonly _tpl = new CodegenTemplateHost('javascript');

  async generate(ast: DeukPackAST, options: GenerationOptions): Promise<{ [filename: string]: string }> {
    DeukPackEngine.resolveExtends(ast);

    const lines: string[] = [];
    const preamble = this._tpl.render('JsFilePreamble.js.tpl', {
      ISO_TIMESTAMP: new Date().toISOString(),
    });
    lines.push(preamble.trimEnd());
    lines.push('');
    lines.push(this._tpl.load('JsRuntimeCore.js.tpl').trimEnd());
    lines.push(this._tpl.load('JsPackRuntime.js.tpl').trimEnd());
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

  private renderJsStructFull(struct: DeukPackStruct, ast: DeukPackAST): string {
    const safeName = struct.name.replace(/\./g, '_');
    const schemaObj = buildEmbeddedStructSchema(struct, ast);
    const fieldIdEntries = (struct.fields || []).map((f) => {
      const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      return `${cap}: ${f.id}`;
    });
    return this._tpl.render('JsStructFull.js.tpl', {
      SAFE_NAME: safeName,
      SCHEMA_JSON: JSON.stringify(schemaObj),
      FIELD_ID_ENTRIES: fieldIdEntries.join(', '),
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
    return this._tpl.render('JsWireProfileStruct.js.tpl', {
      PROFILE: profile,
      SUBSET_EXPORT_NAME: subsetExportName,
      SCHEMA_JSON: JSON.stringify(schemaObj),
    });
  }
}
