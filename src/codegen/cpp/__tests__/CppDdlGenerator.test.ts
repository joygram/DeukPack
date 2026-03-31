/**
 * DeukPack C++ DDL Generator - Unit Tests
 * Tests SQL DDL generation for various Deuk struct patterns
 */

import { DeukPackAST, DeukPackStruct, DeukPackField } from '../../../types/DeukPackTypes';
import { CppDdlGenerator } from '../CppDdlGenerator';

describe('CppDdlGenerator', () => {
  describe('PostgreSQL dialect', () => {
    test('generates simple table with basic types', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'Item',
            annotations: { table: 'true' },
            fields: [
              {
                id: 1,
                name: 'itemId',
                type: 'int32',
                required: true,
                annotations: { primary_key: 'true' },
              } as DeukPackField,
              {
                id: 2,
                name: 'itemName',
                type: 'string',
                required: true,
                annotations: {},
              } as DeukPackField,
              {
                id: 3,
                name: 'rarity',
                type: 'int8',
                required: false,
                annotations: {},
              } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'postgresql');
      const output = generator.generate();

      expect(output.size).toBe(1);
      expect(output.has('item_schema.sql')).toBe(true);

      const schema = output.get('item_schema.sql');
      expect(schema).toContain('CREATE TABLE item (');
      expect(schema).toContain('item_id INTEGER PRIMARY KEY');
      expect(schema).toContain('item_name VARCHAR(255) NOT NULL');
      expect(schema).toContain('rarity SMALLINT');
    });

    test('respects nullable fields', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'User',
            annotations: { table: 'true' },
            fields: [
              {
                id: 1,
                name: 'userId',
                type: 'int32',
                required: true,
                annotations: { primary_key: 'true' },
              } as DeukPackField,
              {
                id: 2,
                name: 'email',
                type: 'string',
                required: true,
                annotations: {},
              } as DeukPackField,
              {
                id: 3,
                name: 'phone',
                type: 'string',
                required: false,
                annotations: {},
              } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'postgresql');
      const output = generator.generate();
      const schema = output.get('user_schema.sql') || '';

      expect(schema).toContain('email VARCHAR(255) NOT NULL');
      expect(schema).not.toContain('phone VARCHAR(255) NOT NULL');
      expect(schema).not.toContain('phone NULLABLE');
    });

    test('excludes editor-only fields', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'Item',
            annotations: { table: 'true' },
            fields: [
              {
                id: 1,
                name: 'itemId',
                type: 'int32',
                required: true,
                annotations: { primary_key: 'true' },
              } as DeukPackField,
              {
                id: 2,
                name: 'editorComments',
                type: 'string',
                required: false,
                annotations: { editorOnly: 'true' },
              } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'postgresql');
      const output = generator.generate();
      const schema = output.get('item_schema.sql') || '';

      expect(schema).not.toContain('editor_comments');
    });
  });

  describe('MySQL dialect', () => {
    test('generates table with MySQL-specific syntax', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'Item',
            annotations: { table: 'true' },
            fields: [
              {
                id: 1,
                name: 'itemId',
                type: 'int32',
                required: true,
                annotations: { primary_key: 'true' },
              } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'mysql');
      const output = generator.generate();
      const schema = output.get('item_schema.sql') || '';

      expect(schema).toContain('ENGINE=InnoDB');
      expect(schema).toContain('DEFAULT CHARSET=utf8mb4');
      expect(schema).toContain('item_id INT PRIMARY KEY AUTO_INCREMENT');
    });
  });

  describe('SQLite dialect', () => {
    test('generates table with SQLite-specific syntax', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'Item',
            annotations: { table: 'true' },
            fields: [
              {
                id: 1,
                name: 'itemId',
                type: 'int32',
                required: true,
                annotations: { primary_key: 'true' },
              } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'sqlite');
      const output = generator.generate();
      const schema = output.get('item_schema.sql') || '';

      expect(schema).toContain('item_id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(schema).not.toContain('ENGINE');
    });
  });

  describe('type mapping', () => {
    test('maps all supported Deuk types to SQL', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'AllTypes',
            annotations: { table: 'true' },
            fields: [
              { id: 1, name: 'id', type: 'int32', required: true, annotations: { primary_key: 'true' } } as DeukPackField,
              { id: 2, name: 'boolVal', type: 'bool', required: false, annotations: {} } as DeukPackField,
              { id: 3, name: 'byteVal', type: 'int8', required: false, annotations: {} } as DeukPackField,
              { id: 4, name: 'shortVal', type: 'int16', required: false, annotations: {} } as DeukPackField,
              { id: 5, name: 'longVal', type: 'int64', required: false, annotations: {} } as DeukPackField,
              { id: 6, name: 'floatVal', type: 'float', required: false, annotations: {} } as DeukPackField,
              { id: 7, name: 'doubleVal', type: 'double', required: false, annotations: {} } as DeukPackField,
              { id: 8, name: 'stringVal', type: 'string', required: false, annotations: {} } as DeukPackField,
              { id: 9, name: 'binaryVal', type: 'binary', required: false, annotations: {} } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'postgresql');
      const output = generator.generate();
      const schema = output.get('all_types_schema.sql') || '';

      expect(schema).toContain('bool_val BOOLEAN');
      expect(schema).toContain('byte_val SMALLINT');
      expect(schema).toContain('short_val SMALLINT');
      expect(schema).toContain('long_val BIGINT');
      expect(schema).toContain('float_val REAL');
      expect(schema).toContain('double_val DOUBLE PRECISION');
      expect(schema).toContain('string_val VARCHAR(255)');
      expect(schema).toContain('binary_val BYTEA');
    });
  });

  describe('non-table structs', () => {
    test('skips structs without @table annotation', () => {
      const ast: DeukPackAST = {
        namespaces: [],
        structs: [
          {
            name: 'DataStruct',
            annotations: {},
            fields: [
              { id: 1, name: 'id', type: 'int32', required: true, annotations: {} } as DeukPackField,
            ] as DeukPackField[],
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;

      const generator = new CppDdlGenerator(ast, 'postgresql');
      const output = generator.generate();

      expect(output.size).toBe(0);
    });
  });

  describe('constraint correctness', () => {
    function makeAst(fields: DeukPackField[], structAnnotations: Record<string, string> = {}): DeukPackAST {
      return {
        namespaces: [],
        structs: [
          {
            name: 'TestTable',
            annotations: { table: 'true', ...structAnnotations },
            fields,
          } as DeukPackStruct,
        ] as DeukPackStruct[],
        enums: [],
        services: [],
        typedefs: [],
        constants: [],
        includes: [],
      } as DeukPackAST;
    }

    test('no duplicate PRIMARY KEY — inline only, no separate constraint line', () => {
      const ast = makeAst([
        { id: 1, name: 'id', type: 'int32', required: true, annotations: { primary_key: 'true' } } as DeukPackField,
        { id: 2, name: 'name', type: 'string', required: true, annotations: {} } as DeukPackField,
      ]);

      const schema = new CppDdlGenerator(ast, 'postgresql').generate().get('test_table_schema.sql') || '';
      // PRIMARY KEY should appear exactly once (inline on the column)
      const pkCount = (schema.match(/PRIMARY KEY/g) || []).length;
      expect(pkCount).toBe(1);
      expect(schema).toContain('id INTEGER PRIMARY KEY');
    });

    test('COMMENT annotation is omitted for PostgreSQL (MySQL-specific syntax)', () => {
      const ast = makeAst([
        { id: 1, name: 'id', type: 'int32', required: true, annotations: { primary_key: 'true' } } as DeukPackField,
        { id: 2, name: 'tag', type: 'string', required: false, annotations: { comment: 'item tag' } } as DeukPackField,
      ]);

      const pgSchema = new CppDdlGenerator(ast, 'postgresql').generate().get('test_table_schema.sql') || '';
      const mySchema = new CppDdlGenerator(ast, 'mysql').generate().get('test_table_schema.sql') || '';

      expect(pgSchema).not.toContain("COMMENT '");
      expect(mySchema).toContain("COMMENT 'item tag'");
    });

    test('@index annotation on PostgreSQL does not produce invalid trailing comma', () => {
      const ast = makeAst(
        [
          { id: 1, name: 'id', type: 'int32', required: true, annotations: { primary_key: 'true' } } as DeukPackField,
          { id: 2, name: 'name', type: 'string', required: true, annotations: {} } as DeukPackField,
        ],
        { index: 'name' },
      );

      const schema = new CppDdlGenerator(ast, 'postgresql').generate().get('test_table_schema.sql') || '';
      // Must not have a trailing comma before the closing paren
      expect(schema).not.toMatch(/,\s*\n\s*\)/);
      // SQLite should also be clean
      const schemaSqlite = new CppDdlGenerator(ast, 'sqlite').generate().get('test_table_schema.sql') || '';
      expect(schemaSqlite).not.toMatch(/,\s*\n\s*\)/);
    });
  });
});
