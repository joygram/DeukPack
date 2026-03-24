/**
 * IDL Parser (.thrift-style source → DeukPackAST)
 * Same pattern as ProtoParser: lexer + shared AST builder.
 */

import * as fs from 'fs/promises';
import { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackService, DeukPackTypedef, DeukPackConstant, DeukPackException } from '../types/DeukPackTypes';
import { IdlLexer } from '../lexer/IdlLexer';
import { DeukPackASTBuilder, DeukPackASTBuilderOptions } from '../ast/DeukPackASTBuilder';

export class IdlParser {
  private lexer: IdlLexer;
  private astBuilder: DeukPackASTBuilder;
  private includeCache: Map<string, DeukPackAST> = new Map();

  constructor() {
    this.lexer = new IdlLexer();
    this.astBuilder = new DeukPackASTBuilder();
  }

  parse(content: string, filePath: string, options?: DeukPackASTBuilderOptions): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, filePath, options);
    } catch (error) {
      throw new DeukPackException(`Failed to parse file ${filePath}: ${(error as Error).message}`);
    }
  }

  async parseFiles(filePaths: string[], options?: DeukPackASTBuilderOptions): Promise<DeukPackAST> {
    const startTime = Date.now();
    try {
      const parsePromises = filePaths.map(filePath => this.parseFile(filePath, options));
      const asts = await Promise.all(parsePromises);
      const mergedAST = this.mergeASTs(asts);
      const endTime = Date.now();
      console.log(`Parsed ${filePaths.length} files in ${endTime - startTime}ms`);
      return mergedAST;
    } catch (error) {
      throw new DeukPackException(`Failed to parse files: ${(error as Error).message}`);
    }
  }

  async parseFile(filePath: string, options?: DeukPackASTBuilderOptions): Promise<DeukPackAST> {
    try {
      if (this.includeCache.has(filePath)) return this.includeCache.get(filePath)!;
      const content = await fs.readFile(filePath, 'utf8');
      const tokens = this.lexer.tokenize(content);
      const ast = this.astBuilder.build(tokens, filePath, options);
      this.includeCache.set(filePath, ast);
      return ast;
    } catch (error) {
      throw new DeukPackException(`Failed to parse file ${filePath}: ${(error as Error).message}`);
    }
  }

  parseContent(content: string, fileName: string = 'input.idl', options?: DeukPackASTBuilderOptions): DeukPackAST {
    try {
      const tokens = this.lexer.tokenize(content);
      return this.astBuilder.build(tokens, fileName, options);
    } catch (error) {
      throw new DeukPackException(`Failed to parse content: ${(error as Error).message}`);
    }
  }

  private mergeASTs(asts: DeukPackAST[]): DeukPackAST {
    const merged: DeukPackAST = {
      namespaces: [],
      structs: [],
      enums: [],
      services: [],
      typedefs: [],
      constants: [],
      includes: [],
      annotations: {}
    };
    for (const ast of asts) {
      merged.namespaces.push(...ast.namespaces);
      merged.structs.push(...ast.structs);
      merged.enums.push(...ast.enums);
      merged.services.push(...ast.services);
      merged.typedefs.push(...(ast.typedefs ?? []));
      merged.constants.push(...(ast.constants ?? []));
      merged.includes.push(...ast.includes);
      if (ast.annotations) Object.assign(merged.annotations!, ast.annotations);
    }
    merged.structs = this.removeDuplicateStructs(merged.structs);
    merged.enums = this.removeDuplicateEnums(merged.enums);
    merged.services = this.removeDuplicateServices(merged.services);
    merged.typedefs = this.removeDuplicateTypedefs(merged.typedefs);
    merged.constants = this.removeDuplicateConstants(merged.constants);
    return merged;
  }

  private removeDuplicateStructs(structs: DeukPackStruct[]): DeukPackStruct[] {
    const seen = new Set<string>();
    return structs.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });
  }

  private removeDuplicateEnums(enums: DeukPackEnum[]): DeukPackEnum[] {
    const seen = new Set<string>();
    return enums.filter(e => { if (seen.has(e.name)) return false; seen.add(e.name); return true; });
  }

  private removeDuplicateServices(services: DeukPackService[]): DeukPackService[] {
    const seen = new Set<string>();
    return services.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });
  }

  private removeDuplicateTypedefs(typedefs: DeukPackTypedef[]): DeukPackTypedef[] {
    const seen = new Set<string>();
    return typedefs.filter(t => { if (seen.has(t.name)) return false; seen.add(t.name); return true; });
  }

  private removeDuplicateConstants(constants: DeukPackConstant[]): DeukPackConstant[] {
    const seen = new Set<string>();
    return constants.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
  }

  clearCache(): void { this.includeCache.clear(); }

  getCacheStats(): { size: number; files: string[] } {
    return { size: this.includeCache.size, files: Array.from(this.includeCache.keys()) };
  }
}
