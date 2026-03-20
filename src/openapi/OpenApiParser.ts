/**
 * OpenAPI 3.x components/schemas → DeukPack AST (struct/enum).
 * Enables OpenAPI → Deuk → OpenAPI round-trip.
 */

import {
  DeukPackAST,
  DeukPackStruct,
  DeukPackEnum,
  DeukPackField,
  DeukPackNamespace,
} from '../types/DeukPackTypes';
import {
  OpenApiSpec,
  OpenApiSchema,
  OpenApiSchemaObject,
  isRef,
  resolveRef,
} from './OpenApiTypes';

const NS_OPENAPI = 'OpenApi';

function toPascal(s: string): string {
  return s.replace(/(?:^|[-_\s])(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function schemaToDeukType(
  schema: OpenApiSchema,
  schemas: Record<string, OpenApiSchema>,
  currentName: string,
  propName: string,
  structsOut: DeukPackStruct[],
  enumsOut: DeukPackEnum[],
  sourceFile: string
): string | { type: 'list'; elementType: any } | { type: 'map'; keyType: string; valueType: any } {
  if (isRef(schema)) {
    return resolveRef(schema.$ref);
  }
  const obj = schema as OpenApiSchemaObject;
  const t = (obj.type || 'string').toLowerCase();
  switch (t) {
    case 'string':
      if (Array.isArray(obj.enum)) {
        const enumName = toPascal(currentName) + toPascal(propName);
        const values: { [k: string]: number } = {};
        obj.enum.forEach((v, i) => {
          const key = String(v).replace(/\s/g, '_');
          values[key] = i;
        });
        enumsOut.push({
          name: enumName,
          values,
          sourceFile,
        });
        return enumName;
      }
      return 'string';
    case 'integer':
      return obj.format === 'int64' ? 'int64' : 'int32';
    case 'number':
      return obj.format === 'float' ? 'float' : 'double';
    case 'boolean':
      return 'bool';
    case 'array':
      if (obj.items) {
        const elem = schemaToDeukType(obj.items, schemas, currentName, propName + 'Item', structsOut, enumsOut, sourceFile);
        return { type: 'list', elementType: elem };
      }
      return { type: 'list', elementType: 'string' };
    case 'object':
      if (obj.properties) {
        const inlineName = toPascal(currentName) + toPascal(propName);
        const fields = objectToFields(inlineName, obj, schemas, structsOut, enumsOut, sourceFile);
        structsOut.push({
          name: inlineName,
          fields,
          sourceFile,
        });
        return inlineName;
      }
      return 'string';
    default:
      return 'string';
  }
}

function objectToFields(
  structName: string,
  obj: OpenApiSchemaObject,
  schemas: Record<string, OpenApiSchema>,
  structsOut: DeukPackStruct[],
  enumsOut: DeukPackEnum[],
  sourceFile: string
): DeukPackField[] {
  const properties = obj.properties || {};
  const required = Array.isArray((obj as any).required) ? (obj as any).required as string[] : [];
  const fields: DeukPackField[] = [];
  let id = 1;
  for (const [name, propSchema] of Object.entries(properties)) {
    const type = schemaToDeukType(propSchema, schemas, structName, name, structsOut, enumsOut, sourceFile);
    const xId = (propSchema as OpenApiSchemaObject)['x-field-id'];
    const fieldId = xId ?? id++;
    fields.push({
      id: fieldId,
      name,
      type: type as any,
      required: required.includes(name),
    });
  }
  return fields;
}

/**
 * Parse OpenAPI 3.x spec and return structs/enums from components/schemas.
 * Caller can merge result into existing AST.
 */
export function importOpenApiSchemas(spec: OpenApiSpec, sourceFile: string = 'openapi.yaml'): {
  structs: DeukPackStruct[];
  enums: DeukPackEnum[];
  namespace: string;
} {
  const structs: DeukPackStruct[] = [];
  const enums: DeukPackEnum[] = [];
  const schemas = spec.components?.schemas || {};
  const ns = spec.info?.title?.replace(/\s/g, '_') || NS_OPENAPI;

  for (const [name, schema] of Object.entries(schemas)) {
    if (isRef(schema)) continue;
    const obj = schema as OpenApiSchemaObject;
    if (obj.type === 'string' && Array.isArray(obj.enum)) {
      const values: { [k: string]: number } = {};
      obj.enum.forEach((v, i) => {
        const key = String(v).replace(/\s/g, '_');
        values[key] = i;
      });
      enums.push({ name, values, sourceFile });
      continue;
    }
    if (obj.type === 'object' && obj.properties) {
      const fields = objectToFields(name, obj, schemas, structs, enums, sourceFile);
      const struct: DeukPackStruct = { name, fields, sourceFile };
      if (obj.description) struct.docComment = obj.description;
      structs.push(struct);
    }
  }

  return { structs, enums, namespace: ns };
}

/**
 * Build a full DeukPackAST from an OpenAPI spec (for merge or standalone use).
 */
export function parseOpenApiToAst(spec: OpenApiSpec, sourceFile: string = 'openapi.yaml'): DeukPackAST {
  const { structs, enums, namespace } = importOpenApiSchemas(spec, sourceFile);
  const ns: DeukPackNamespace = { language: '*', name: namespace, sourceFile };
  return {
    namespaces: [ns],
    structs,
    enums,
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: { [sourceFile]: namespace },
  };
}
