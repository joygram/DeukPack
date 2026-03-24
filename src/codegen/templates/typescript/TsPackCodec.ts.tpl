export const @@STRUCT_SHORT_NAME@@_PackSchema = JSON.parse(@@PACK_JSON_STR@@) as EmbeddedPackStructSchema;
@@PACK_REG@@[@@STRUCT_SHORT_NAME@@_PackSchema.name] = @@STRUCT_SHORT_NAME@@_PackSchema;
export function @@CODEC_FN_BASE@@ToPackBinary(obj: @@STRUCT_SHORT_NAME@@): Uint8Array {
  return structToPackBinary(@@STRUCT_SHORT_NAME@@_PackSchema, obj as Record<string, unknown>, @@PACK_REG@@);
}
export function @@CODEC_FN_BASE@@FromPackBinary(buf: Uint8Array): @@STRUCT_SHORT_NAME@@ {
  return structFromPackBinary(@@STRUCT_SHORT_NAME@@_PackSchema, buf, @@PACK_REG@@) as @@STRUCT_SHORT_NAME@@;
}
