import { 
  DeukPackAST
} from '../types/DeukPackTypes';

/**
 * DeukPackAST Utilities
 * Provides functions for merging and deduplicating AST objects.
 */
export class DeukPackASTUtils {
  /**
   * Merges multiple AST objects into a single one.
   * Elements with the same name will be present multiple times in the merged AST
   * unless deduplicateAST is called afterwards.
   */
  static mergeASTs(asts: DeukPackAST[]): DeukPackAST {
    const merged: DeukPackAST = {
      namespaces: [],
      structs: [],
      enums: [],
      services: [],
      typedefs: [],
      constants: [],
      includes: [],
      annotations: {},
      fileIncludes: {},
      fileNamespaceMap: {}
    };

    for (const ast of asts) {
      merged.namespaces.push(...ast.namespaces);
      merged.structs.push(...ast.structs);
      merged.enums.push(...ast.enums);
      merged.services.push(...ast.services);
      merged.typedefs.push(...(ast.typedefs ?? []));
      merged.constants.push(...(ast.constants ?? []));
      merged.includes.push(...ast.includes);
      
      if (ast.annotations) {
        Object.assign(merged.annotations!, ast.annotations);
      }
      
      if (ast.fileIncludes) {
        Object.assign(merged.fileIncludes!, ast.fileIncludes);
      }
      
      if (ast.fileNamespaceMap) {
        Object.assign(merged.fileNamespaceMap!, ast.fileNamespaceMap);
      }
      
      if (ast.filesProcessed !== undefined) {
        merged.filesProcessed = (merged.filesProcessed ?? 0) + ast.filesProcessed;
      }
    }

    return merged;
  }

  /**
   * Deduplicates elements in an AST based on their names.
   * Keeps the first occurrence of each named element.
   */
  static deduplicateAST(ast: DeukPackAST): DeukPackAST {
    return {
      ...ast,
      structs: this.removeDuplicates(ast.structs),
      enums: this.removeDuplicates(ast.enums),
      services: this.removeDuplicates(ast.services),
      typedefs: this.removeDuplicates(ast.typedefs),
      constants: this.removeDuplicates(ast.constants)
    };
  }

  private static removeDuplicates<T extends { name: string }>(elements: T[]): T[] {
    const seen = new Set<string>();
    return elements.filter(el => {
      if (seen.has(el.name)) {
        return false;
      }
      seen.add(el.name);
      return true;
    });
  }

  /**
   * Deep merge and deduplicate.
   */
  static mergeAndDeduplicate(asts: DeukPackAST[]): DeukPackAST {
    return this.deduplicateAST(this.mergeASTs(asts));
  }
}
