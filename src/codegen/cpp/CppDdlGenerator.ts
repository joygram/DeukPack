/**
 * DeukPack C++ DDL Generator
 * Converts Deuk structs → SQL CREATE TABLE statements
 * Supports: MySQL, PostgreSQL, SQLite
 */

import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackField,
  DeukPackType,
} from '../../types/DeukPackTypes';

export type SqlDialect = 'mysql' | 'postgresql' | 'sqlite';

type ColumnDef = {
  name: string;
  sqlType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: string | undefined;
  comment?: string | undefined;
};

type ConstraintDef = {
  kind: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'INDEX';
  columns: string[];
  refTable?: string;
  refColumn?: string;
  name?: string;
};

export class CppDdlGenerator {
  private dialect: SqlDialect;
  private ast: DeukPackAST;

  constructor(ast: DeukPackAST, dialect: SqlDialect = 'postgresql') {
    this.ast = ast;
    this.dialect = dialect;
  }

  /**
   * Generate SQL DDL for all table structs
   */
  generate(): Map<string, string> {
    const output = new Map<string, string>();

    for (const struct of this.ast.structs || []) {
      if (this.isTableStruct(struct)) {
        const ddl = this.generateTableDdl(struct);
        const filename = this.toSnakeCase(struct.name || '') + '_schema.sql';
        output.set(filename, ddl);
      }
    }

    return output;
  }

  /**
   * Determine if struct represents a database table (opt-in via annotation)
   */
  private isTableStruct(struct: DeukPackStruct): boolean {
    // Check for @table annotation
    if (struct.annotations && struct.annotations['table'] === 'true') {
      return true;
    }
    // By default, all structs that have a unique/primary key can be tables
    // For now, generate DDL for structs that have explicit @table annotation
    return false;
  }

  /**
   * Generate CREATE TABLE statement for single struct
   */
  private generateTableDdl(struct: DeukPackStruct): string {
    const tableName = this.toSnakeCase(struct.name || '');
    const columns = this.parseColumns(struct);
    const constraints = this.parseConstraints(struct, columns);

    let ddl = `-- Generated from struct: ${struct.name}\n`;
    ddl += `CREATE TABLE ${tableName} (\n`;

    // Columns
    const columnLines = columns.map((col) => this.renderColumn(col)).join(',\n');
    ddl += `  ${columnLines.split('\n').join('\n  ')}`;

    // Constraints (if any), filter out empty strings (e.g. INDEX on non-MySQL)
    const constraintLines = constraints
      .map((c) => this.renderConstraint(c, tableName))
      .filter((l) => l !== '');
    if (constraintLines.length > 0) {
      const rendered = constraintLines.join(',\n');
      ddl += `,\n  ${rendered.split('\n').join('\n  ')}`;
    }

    ddl += '\n)';

    // Dialect-specific suffix
    if (this.dialect === 'mysql') {
      ddl += ` ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    }

    ddl += ';\n';

    return ddl;
  }

  /**
   * Parse struct fields into ColumnDef list
   */
  private parseColumns(struct: DeukPackStruct): ColumnDef[] {
    const columns: ColumnDef[] = [];

    for (const field of struct.fields || []) {
      if (this.shouldIncludeField(field)) {
        const col: ColumnDef = {
          name: this.toSnakeCase(field.name || ''),
          sqlType: this.deukTypeToSqlType(field.type),
          nullable: !field.required,
          isPrimaryKey: field.annotations?.['primary_key'] === 'true',
          isUnique: field.annotations?.['unique'] === 'true',
          defaultValue: field.annotations?.['default'],
          comment: field.annotations?.['comment'],
        };
        columns.push(col);
      }
    }

    return columns;
  }

  /**
   * Determine which fields to include in schema
   */
  private shouldIncludeField(field: DeukPackField): boolean {
    // Exclude editor-only and transient fields
    if (field.annotations) {
      if (field.annotations['editorOnly'] === 'true' || field.annotations['transient'] === 'true') {
        return false;
      }
    }
    return true;
  }

  /**
   * Map Deuk type to SQL type (dialect-aware)
   */
  private deukTypeToSqlType(type: DeukPackType | string): string {
    const typeStr = typeof type === 'string' ? type : (type as any).baseType || '';

    const typeMap: Record<string, Record<SqlDialect, string>> = {
      bool: { mysql: 'TINYINT(1)', postgresql: 'BOOLEAN', sqlite: 'INTEGER' },
      int8: { mysql: 'TINYINT', postgresql: 'SMALLINT', sqlite: 'INTEGER' },
      int16: { mysql: 'SMALLINT', postgresql: 'SMALLINT', sqlite: 'INTEGER' },
      int32: { mysql: 'INT', postgresql: 'INTEGER', sqlite: 'INTEGER' },
      int64: { mysql: 'BIGINT', postgresql: 'BIGINT', sqlite: 'INTEGER' },
      float: { mysql: 'FLOAT', postgresql: 'REAL', sqlite: 'REAL' },
      double: { mysql: 'DOUBLE', postgresql: 'DOUBLE PRECISION', sqlite: 'REAL' },
      // Legacy aliases kept for backward compatibility with older AST emitters
      float32: { mysql: 'FLOAT', postgresql: 'REAL', sqlite: 'REAL' },
      float64: { mysql: 'DOUBLE', postgresql: 'DOUBLE PRECISION', sqlite: 'REAL' },
      string: { mysql: 'VARCHAR(255)', postgresql: 'VARCHAR(255)', sqlite: 'TEXT' },
      binary: { mysql: 'BLOB', postgresql: 'BYTEA', sqlite: 'BLOB' },
      datetime: { mysql: 'TIMESTAMP', postgresql: 'TIMESTAMP', sqlite: 'TEXT' },
      date: { mysql: 'DATE', postgresql: 'DATE', sqlite: 'TEXT' },
      time: { mysql: 'TIME', postgresql: 'TIME', sqlite: 'TEXT' },
    };

    return typeMap[typeStr]?.[this.dialect] || 'TEXT';
  }

  /**
   * Parse constraints from struct metadata
   */
  private parseConstraints(struct: DeukPackStruct, columns: ColumnDef[]): ConstraintDef[] {
    const constraints: ConstraintDef[] = [];

    // Unique constraints
    for (const col of columns) {
      if (col.isUnique) {
        constraints.push({
          kind: 'UNIQUE',
          columns: [col.name],
        });
      }
    }

    // Indexes from annotations
    if (struct.annotations?.['index']) {
      const indexCols = struct.annotations['index'].split(',').map((c: string) => this.toSnakeCase(c.trim()));
      if (indexCols.length > 0) {
        constraints.push({
          kind: 'INDEX',
          columns: indexCols,
        });
      }
    }

    return constraints;
  }

  /**
   * Render single column definition
   */
  private renderColumn(col: ColumnDef): string {
    let def = `${col.name} ${col.sqlType}`;

    if (!col.nullable && !col.isPrimaryKey) {
      def += ' NOT NULL';
    }

    if (col.isPrimaryKey) {
      if (this.dialect === 'mysql') {
        def += ' PRIMARY KEY AUTO_INCREMENT';
      } else if (this.dialect === 'postgresql') {
        def += ' PRIMARY KEY';
      } else if (this.dialect === 'sqlite') {
        def += ' PRIMARY KEY AUTOINCREMENT';
      }
    }

    if (col.defaultValue) {
      def += ` DEFAULT ${col.defaultValue}`;
    }

    // COMMENT is MySQL-specific inline syntax; PostgreSQL uses COMMENT ON COLUMN separately
    if (col.comment && this.dialect === 'mysql') {
      def += ` COMMENT '${this.escapeSql(col.comment)}'`;
    }

    return def;
  }

  /**
   * Render constraint definition
   */
  private renderConstraint(constraint: ConstraintDef, _tableName: string): string {
    const cols = constraint.columns.join(', ');

    switch (constraint.kind) {
      case 'PRIMARY_KEY':
        return `PRIMARY KEY (${cols})`;
      case 'UNIQUE':
        return `UNIQUE (${cols})`;
      case 'INDEX':
        // Indexes are rendered separately in PostgreSQL/SQLite
        if (this.dialect === 'mysql') {
          return `INDEX idx_${cols.replace(/,/g, '_')} (${cols})`;
        }
        return ''; // Handled separately
      case 'FOREIGN_KEY':
        return `FOREIGN KEY (${cols}) REFERENCES ${constraint.refTable}(${constraint.refColumn})`;
      default:
        return '';
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  /**
   * Escape SQL string literals
   */
  private escapeSql(str: string): string {
    return str.replace(/'/g, "''");
  }
}
