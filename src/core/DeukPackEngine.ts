/**
 * DeukPack - Core Engine
 * Multi-language IDL and wire support
 */

import { DeukPackAST, DeukPackError, DeukPackException, PerformanceMetrics, SerializationOptions, GenerationOptions, DeukPackStruct, DeukPackEnum, DeukPackNamespace, DeukPackTypedef, DeukPackConstant, DeukPackService, ParseFileWithIncludesOptions } from '../types/DeukPackTypes';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { IdlParser } from './IdlParser';
import { DeukParser } from './DeukParser';
import { ProtoParser } from './ProtoParser';
import { DeukPackGenerator } from './DeukPackGenerator';
import { WireSerializer } from '../serialization/WireSerializer';
import { WireDeserializer } from '../serialization/WireDeserializer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export class DeukPackEngine {
  private parser: IdlParser;
  private deukParser: DeukParser;
  private protoParser: ProtoParser;
  private generator: DeukPackGenerator;
  private serializer: WireSerializer;
  private deserializer: WireDeserializer;
  private performanceMonitor: PerformanceMonitor;
  private useNative: boolean = false;
  private performanceMetrics: PerformanceMetrics = {
    parseTime: 0,
    generateTime: 0,
    serializeTime: 0,
    deserializeTime: 0,
    memoryUsage: 0,
    fileCount: 0,
    lineCount: 0
  };

  constructor(useNative: boolean = false) {
    this.parser = new IdlParser();
    this.deukParser = new DeukParser();
    this.protoParser = new ProtoParser();
    this.generator = new DeukPackGenerator();
    this.serializer = new WireSerializer();
    this.deserializer = new WireDeserializer();
    this.performanceMonitor = new PerformanceMonitor();
    this.useNative = useNative;
  }

  /**
   * Parse IDL files into AST
   */
  async parseFiles(filePaths: string[]): Promise<DeukPackAST> {
    try {
      return await this.parser.parseFiles(filePaths);
    } catch (error) {
      throw new DeukPackException(`Failed to parse files: ${(error as Error).message}`);
    }
  }

  /**
   * Generate code from AST
   */
  async generateCode(ast: DeukPackAST, options: GenerationOptions): Promise<void> {
    try {
      await this.generator.generateCode(ast, options);
    } catch (error) {
      throw new DeukPackException(`Failed to generate code: ${(error as Error).message}`);
    }
  }

  /**
   * Serialize object to wire format
   */
  serialize<T>(obj: T, options: SerializationOptions): Uint8Array {
    try {
      return this.serializer.serialize(obj, options);
    } catch (error) {
      throw new DeukPackException(`Failed to serialize object: ${(error as Error).message}`);
    }
  }

  /**
   * Deserialize wire format to object
   */
  deserialize<T>(data: Uint8Array, targetType: new() => T, options: SerializationOptions): T {
    try {
      return this.deserializer.deserialize(Buffer.from(data), targetType, options);
    } catch (error) {
      throw new DeukPackException(`Failed to deserialize data: ${(error as Error).message}`);
    }
  }

  /**
   * Parse a single IDL file
   */
  async parseFile(filePath: string): Promise<DeukPackAST> {
    const startTime = Date.now();

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = this.parser.parse(content, filePath);

      this.performanceMetrics.parseTime = Date.now() - startTime;
      this.performanceMetrics.fileCount = 1;

      return ast;
    } catch (error) {
      throw new Error(`Failed to parse file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse an IDL file with all its includes.
   * @param filePath - 진입 IDL 파일 경로
   * @param options - includePaths 지정 시 해당 경로만 사용, 미지정 시 defineRoot 기준으로 경로 구성 (기본 defineRoot: 'idls').
   *                 호환: 두 번째 인자를 string[]로 주면 includePaths로 간주.
   */
  async parseFileWithIncludes(filePath: string, options?: ParseFileWithIncludesOptions | string[]): Promise<DeukPackAST> {
    const startTime = Date.now();
    const processedFiles = new Set<string>();
    const allStructs: DeukPackStruct[] = [];
    const allEnums: DeukPackEnum[] = [];
    const allNamespaces: DeukPackNamespace[] = [];
    const allTypedefs: DeukPackTypedef[] = [];
    const allConstants: DeukPackConstant[] = [];
    const allServices: DeukPackService[] = [];
    const allIncludes: string[] = [];
    const fileNamespaceMap: { [filePath: string]: string } = {};

    const opts: ParseFileWithIncludesOptions = Array.isArray(options) ? { includePaths: options } : (options ?? {});
    const customIncludePaths = opts.includePaths;
    const defineRoot = opts.defineRoot ?? 'idls';

    const baseDir = path.dirname(filePath);

    const SUBDIRS = ['_engine', 'engine', 'game_define', 'deuk_table', 'protocol_server', 'protocol_user', 'generated_define', '_project_common'] as const;

    const parseFileRecursive = async (currentPath: string) => {
      if (processedFiles.has(currentPath)) {
        return;
      }

      processedFiles.add(currentPath);

      const content = await fs.readFile(currentPath, 'utf-8');
      const ext = path.extname(currentPath).toLowerCase();
      const ast = ext === '.deuk'
        ? this.deukParser.parse(content, currentPath)
        : ext === '.proto'
          ? this.protoParser.parse(content, currentPath)
          : this.parser.parse(content, currentPath);

      // 파일의 네임스페이스 찾기 및 저장
      const namespaceForFile = ast.namespaces.find(ns => ns.language === '*' || ns.language === 'csharp');
      if (namespaceForFile) {
        fileNamespaceMap[currentPath] = namespaceForFile.name;
        namespaceForFile.sourceFile = currentPath;
      }

      // Merge all definitions
      allStructs.push(...ast.structs);
      allEnums.push(...ast.enums);
      allNamespaces.push(...ast.namespaces);
      allTypedefs.push(...ast.typedefs);
      allConstants.push(...ast.constants);
      allServices.push(...ast.services);
      allIncludes.push(...ast.includes);

      // table/container 사용 시 deuk.deuk를 최종 AST에만 추가 (파싱은 하지 않음 — 코드젠용)
      if (processedFiles.size === 1 && ast.structs) {
        const hasTable = ast.structs.some(s => {
          const f = s.fields;
          return (s.name === 'table' || s.name === 'container') && f && f.length >= 2 && f[0]?.name === 'header' && f[1]?.name === 'infos';
        });
        if (hasTable && !allIncludes.some(inc => inc.trim().toLowerCase().endsWith('deuk.deuk'))) {
          allIncludes.push('deuk.deuk');
        }
      }

      // Process includes: customIncludePaths 있으면 먼저 사용, 이어서 defineRoot 기준 경로 추가
      for (const include of ast.includes) {
        const trimmedInclude = include.trim();

        const buildDefineRootPaths = (): string[] => {
          const list: string[] = [
            path.resolve(baseDir, trimmedInclude),
            ...SUBDIRS.flatMap(sub => [
              path.resolve(baseDir, '..', sub, trimmedInclude),
              path.resolve(baseDir, '../..', defineRoot, sub, trimmedInclude)
            ]),
            path.resolve(baseDir, '../..', defineRoot, trimmedInclude)
          ];
          const cwdRoot = path.resolve(process.cwd(), '..', '..', defineRoot);
          list.push(path.resolve(cwdRoot, trimmedInclude));
          SUBDIRS.forEach(sub => list.push(path.resolve(cwdRoot, sub, trimmedInclude)));
          return list;
        };

        const customResolved = customIncludePaths && customIncludePaths.length > 0
          ? customIncludePaths.filter(p => p).map(p => path.resolve(p, trimmedInclude))
          : [];
        const defineRootPaths = buildDefineRootPaths();
        const includePaths = customResolved.length > 0 ? [...customResolved, ...defineRootPaths] : defineRootPaths;

        let found = false;
        for (const includePath of includePaths) {
          if (includePath && existsSync(includePath)) {
            await parseFileRecursive(includePath);
            found = true;
            break;
          }
        }

        if (!found) {
          const errorMsg = `Could not find include file: ${trimmedInclude}`;
          console.error(`[DeukPack ERROR] ${errorMsg}`);
          console.error(`[DeukPack]   Referenced from: ${currentPath}`);
          console.error(`[DeukPack]   Original include string: "${include}"`);
          console.error(`[DeukPack]   Searched in ${includePaths.length} locations:`);
          if (customIncludePaths) {
            console.error(`[DeukPack]   Using custom include paths (-I options): ${customIncludePaths.join(', ')}`);
          }
          for (let i = 0; i < Math.min(10, includePaths.length); i++) {
            const checkPath = includePaths[i];
            console.error(`[DeukPack]     ${i + 1}. ${checkPath} [${checkPath && existsSync(checkPath) ? 'EXISTS' : 'NOT FOUND'}]`);
          }
          if (includePaths.length > 10) {
            console.error(`[DeukPack]     ... and ${includePaths.length - 10} more locations`);
          }
          throw new Error(`${errorMsg} (referenced from ${currentPath})`);
        }
      }
    };

    try {
      await parseFileRecursive(filePath);

      const referencedEnums = new Map<string, { namespace: string, name: string }>();

      for (const struct of allStructs) {
        for (const field of struct.fields) {
          let typeStr = '';
          if (typeof field.type === 'string') {
            typeStr = field.type;
          } else if (typeof field.type === 'object' && field.type !== null) {
            if ('structType' in field.type && typeof (field.type as any).structType === 'string') {
              typeStr = (field.type as any).structType;
            }
          }

          if (typeStr && typeof typeStr === 'string' && typeStr.includes('.')) {
            const parts = typeStr.split('.');
            if (parts.length === 2) {
              const [nsName, typeName] = parts;
              if (typeName && typeof typeName === 'string' && nsName && typeof nsName === 'string' && typeName.endsWith('_e')) {
                const existingEnum = allEnums.find(e => e.name === typeName);
                const existingStruct = allStructs.find(s => s.name === typeName);

                if (!existingEnum && !existingStruct) {
                  const key = `${nsName}.${typeName}`;
                  if (!referencedEnums.has(key)) {
                    const namespaceDef = allNamespaces.find(ns => ns.name === nsName);
                    const targetFile = (namespaceDef?.sourceFile ||
                                      Object.keys(fileNamespaceMap).find(f => fileNamespaceMap[f] === nsName) ||
                                      filePath) as string;

                    referencedEnums.set(key, { namespace: nsName as string, name: typeName as string });

                    const finalTargetFile: string = targetFile || filePath;
                    if (!allEnums.find(e => e.name === typeName && (e.sourceFile ?? '') === finalTargetFile)) {
                      const newEnum: DeukPackEnum = {
                        name: typeName,
                        values: { _NONE: 0, _END: 1 } as { [key: string]: number },
                        sourceFile: finalTargetFile as string
                      };
                      allEnums.push(newEnum);
                    }
                  }
                }
              }
            }
          }
        }
      }

      const mergedAST: DeukPackAST = {
        structs: allStructs,
        enums: allEnums,
        namespaces: allNamespaces,
        typedefs: allTypedefs,
        constants: allConstants,
        services: allServices,
        includes: allIncludes,
        filesProcessed: processedFiles.size,
        fileNamespaceMap: fileNamespaceMap
      };

      this.performanceMetrics.parseTime = Date.now() - startTime;
      this.performanceMetrics.fileCount = processedFiles.size;

      return mergedAST;
    } catch (error) {
      throw new Error(`Failed to parse file with includes ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Build complete project from IDL files
   */
  async build(filePaths: string[], _outputDir: string, options: GenerationOptions): Promise<PerformanceMetrics> {
    try {
      const ast = await this.parseFiles(filePaths);
      await this.generateCode(ast, options);
      return this.getPerformanceMetrics();
    } catch (error) {
      throw new DeukPackException(`Failed to build project: ${(error as Error).message}`);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMonitor.reset();
  }

  /**
   * Resolve struct extends: prepend parent fields into child (flat merge).
   * Supports multi-level inheritance. Throws on field ID collision.
   */
  static resolveExtends(ast: DeukPackAST): void {
    if ((ast as any)._extendsResolved) return;

    const byName = new Map<string, DeukPackStruct>();
    for (const s of ast.structs) {
      byName.set(s.name, s);
      const dotIdx = s.name.lastIndexOf('.');
      if (dotIdx >= 0) byName.set(s.name.slice(dotIdx + 1), s);
    }

    const resolved = new Set<string>();
    const resolving = new Set<string>();

    const resolve = (s: DeukPackStruct) => {
      if (resolved.has(s.name)) return;
      if (resolving.has(s.name)) throw new Error(`Circular extends: ${s.name}`);
      if (!s.extends) { resolved.add(s.name); return; }

      resolving.add(s.name);

      const parent = byName.get(s.extends);
      if (!parent) throw new Error(`struct ${s.name} extends unknown type '${s.extends}'`);
      resolve(parent);

      const childIds = new Set(s.fields.map(f => f.id));
      for (const pf of parent.fields) {
        if (childIds.has(pf.id)) {
          throw new Error(`Field ID ${pf.id} in parent '${parent.name}' collides with field in '${s.name}'`);
        }
      }

      s.fields = [...parent.fields, ...s.fields];
      resolving.delete(s.name);
      resolved.add(s.name);
    };

    for (const s of ast.structs) resolve(s);
    (ast as any)._extendsResolved = true;
  }

  /**
   * Validate schema
   */
  validateSchema(ast: DeukPackAST): DeukPackError[] {
    const errors: DeukPackError[] = [];

    for (const structDef of ast.structs) {
      const fieldIds = new Set<number>();
      for (const field of structDef.fields) {
        if (fieldIds.has(field.id)) {
          errors.push({
            message: `Duplicate field ID ${field.id} in struct ${structDef.name}`,
            line: 0,
            column: 0,
            file: '',
            severity: 'error'
          });
        }
        fieldIds.add(field.id);
      }
    }

    for (const enumDef of ast.enums) {
      const values = new Set<number>();
      for (const [, value] of Object.entries(enumDef.values)) {
        if (values.has(value)) {
          errors.push({
            message: `Duplicate enum value ${value} in enum ${enumDef.name}`,
            line: 0,
            column: 0,
            file: '',
            severity: 'error'
          });
        }
        values.add(value);
      }
    }

    return errors;
  }

  /**
   * Get engine information
   */
  getEngineInfo(): { name: string; version: string; native: boolean } {
    return {
      name: 'DeukPack',
      version: '1.0.0',
      native: this.useNative
    };
  }
}
