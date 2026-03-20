/**
 * Minimal OpenAPI 3.x types for components/schemas round-trip.
 */

export interface OpenApiRef {
  $ref: string;
}

export interface OpenApiSchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  enum?: (string | number)[];
  description?: string;
  /** DeukPack: preserve field id when emitting */
  'x-field-id'?: number;
}

export type OpenApiSchema = OpenApiRef | OpenApiSchemaObject;

export interface OpenApiComponents {
  schemas?: Record<string, OpenApiSchema>;
}

export interface OpenApiSpec {
  openapi?: string;
  info?: { title?: string; version?: string };
  components?: OpenApiComponents;
}

export function isRef(schema: OpenApiSchema): schema is OpenApiRef {
  return schema !== null && typeof schema === 'object' && '$ref' in schema;
}

export function resolveRef(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1] || '';
}
