/**
 * DeukPack AST → OpenAPI 3.x components/schemas.
 * Enables Deuk → OpenAPI round-trip (with OpenApiParser).
 */

import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackEnum,
  DeukPackType,
} from '../types/DeukPackTypes';
import { OpenApiSpec, OpenApiSchemaObject } from './OpenApiTypes';

function fieldTypeToOpenApiSchema(
  type: DeukPackType,
  ast: DeukPackAST,
  currentNs: string
): OpenApiSchemaObject | { $ref: string } {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return { type: 'boolean' };
      case 'byte':
      case 'int8':
      case 'int16':
      case 'int32':
        return { type: 'integer', format: 'int32' };
      case 'int64':
        return { type: 'integer', format: 'int64' };
      case 'float':
      case 'double':
        return { type: 'number', format: type };
      case 'string':
        return { type: 'string' };
      case 'binary':
        return { type: 'string', format: 'byte' };
      default: {
        const short = type.includes('.') ? type.split('.').pop()! : type;
        return { $ref: `#/components/schemas/${short}` };
      }
    }
  }
  if (typeof type === 'object' && type !== null) {
    if (type.type === 'list' || type.type === 'array' || type.type === 'set') {
      const items = fieldTypeToOpenApiSchema(type.elementType, ast, currentNs);
      const base: OpenApiSchemaObject = {
        type: 'array',
        items: '$ref' in items ? items : items,
      } as OpenApiSchemaObject;
      if (type.type === 'array' && 'size' in type && typeof (type as { size?: number }).size === 'number') {
        (base as OpenApiSchemaObject & { maxItems?: number }).maxItems = (type as { size: number }).size;
      }
      return base;
    }
    if (type.type === 'map') {
      const valueSchema = fieldTypeToOpenApiSchema(type.valueType, ast, currentNs);
      return {
        type: 'object',
        additionalProperties: valueSchema,
      } as OpenApiSchemaObject;
    }
  }
  return { type: 'string' };
}

function structToOpenApiSchema(struct: DeukPackStruct, ast: DeukPackAST, currentNs: string): OpenApiSchemaObject {
  const properties: Record<string, OpenApiSchemaObject & { 'x-field-id'?: number }> = {};
  const required: string[] = [];
  for (const f of struct.fields || []) {
    const schema = fieldTypeToOpenApiSchema(f.type, ast, currentNs) as OpenApiSchemaObject;
    const prop: OpenApiSchemaObject & { 'x-field-id'?: number } = { ...schema };
    if (f.required) required.push(f.name);
    prop['x-field-id'] = f.id;
    properties[f.name] = prop;
  }
  const out: OpenApiSchemaObject & { required?: string[] } = {
    type: 'object',
    properties,
  };
  if (struct.docComment) out.description = struct.docComment;
  if (required.length > 0) out.required = required;
  return out;
}

function enumToOpenApiSchema(enumDef: DeukPackEnum): OpenApiSchemaObject {
  const values = Object.keys(enumDef.values || {}).sort((a, b) => {
    const va = enumDef.values![a] ?? 0;
    const vb = enumDef.values![b] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  const out: OpenApiSchemaObject = { type: 'string', enum: values };
  if (enumDef.docComment) out.description = enumDef.docComment;
  return out;
}

/**
 * Generate OpenAPI 3.x spec from DeukPack AST (components/schemas only).
 * Structs and enums are emitted under one namespace; schema names are short names.
 */
export function generateOpenApiFromAst(ast: DeukPackAST, options?: { title?: string; version?: string }): OpenApiSpec {
  const schemas: Record<string, OpenApiSchemaObject> = {};
  const ns = ast.namespaces?.[0]?.name ?? 'OpenApi';

  for (const e of ast.enums || []) {
    schemas[e.name] = enumToOpenApiSchema(e);
  }
  for (const s of ast.structs || []) {
    const shortName = s.name.includes('.') ? s.name.split('.').pop()! : s.name;
    schemas[shortName] = structToOpenApiSchema(s, ast, ns);
  }

  return {
    openapi: '3.0.0',
    info: {
      title: options?.title ?? ns,
      version: options?.version ?? '1.0.0',
    },
    components: { schemas },
  };
}
