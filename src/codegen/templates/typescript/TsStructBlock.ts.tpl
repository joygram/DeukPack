/** @generated */
export interface @@STRUCT_SHORT_NAME@@ {
@@INTERFACE_FIELDS@@
}

/** Field IDs for @@STRUCT_SHORT_NAME@@. @generated */
export const @@STRUCT_SHORT_NAME@@_FieldId = {
@@FIELD_ID_ENTRIES@@
} as const;

/** DeukPack Proxy Methods for @@STRUCT_SHORT_NAME@@. @generated */
export declare const @@STRUCT_SHORT_NAME@@: {
  getSchema(): any;
  create(): @@STRUCT_SHORT_NAME@@;
  pack(obj: @@STRUCT_SHORT_NAME@@, format?: 'binary'|'json', fieldIds?: number[], overrides?: any): Uint8Array | string;
  unpack(buf: any, format?: 'binary'|'json'): @@STRUCT_SHORT_NAME@@;
  unpack(obj: @@STRUCT_SHORT_NAME@@, buf: any, format?: 'binary'|'json'): @@STRUCT_SHORT_NAME@@;
  /** @deprecated use pack() */
  toBinary(obj: @@STRUCT_SHORT_NAME@@, fieldIds?: number[], overrides?: any): Uint8Array;
  /** @deprecated use unpack() */
  fromBinary(buf: Uint8Array | ArrayBuffer | number[]): @@STRUCT_SHORT_NAME@@;
  fromExcel(sheet: any, row: number): @@STRUCT_SHORT_NAME@@;
  fromExcelSheet?(sheet: any, firstRow: number): @@STRUCT_SHORT_NAME@@[];
};
