/**
 * DeukPack JSON Protocol
 * DpProtocol-compatible JSON wire format
 */

import type {
  DpProtocol,
  DpStruct,
  DpField,
  DpList,
  DpSet,
  DpMap
} from './WireProtocol';
import { DpWireType } from './WireProtocol';

type JsonObj = Record<string, unknown>;
type JsonValue = string | number | boolean | JsonObj | JsonValue[];

const DP_WIRE_TYPE_KEYS: Record<DpWireType, string> = {
  [DpWireType.Stop]: '',
  [DpWireType.Void]: '',
  [DpWireType.Bool]: 'tf',
  [DpWireType.Byte]: 'i8',
  [DpWireType.Double]: 'dbl',
  [DpWireType.I16]: 'i16',
  [DpWireType.I32]: 'i32',
  [DpWireType.I64]: 'i64',
  [DpWireType.String]: 'str',
  [DpWireType.Struct]: 'rec',
  [DpWireType.Map]: 'map',
  [DpWireType.Set]: 'set',
  [DpWireType.List]: 'lst'
};

function wrapValue(type: DpWireType, value: JsonValue): JsonObj {
  const key = DP_WIRE_TYPE_KEYS[type] || 'str';
  return { [key]: value };
}

function wrapValueForMap(value: JsonValue): JsonValue {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array))
    return value;
  if (typeof value === 'boolean') return { tf: value };
  if (typeof value === 'number') return { i64: value };
  if (typeof value === 'string') return { str: value };
  if (Array.isArray(value)) return { lst: value };
  return { str: String(value) };
}

export class DpJsonProtocol implements DpProtocol {
  private output: string = '';
  private writeStack: JsonObj[] = [];
  private listStack: unknown[][] = [];
  private mapStack: { map: JsonObj; pendingKey: string | null }[] = [];
  private currentFieldKey: string = '';
  private currentFieldType: DpWireType = DpWireType.Stop;

  private readRoot: JsonObj | null = null;
  private readStack: { obj: JsonObj; keys: string[]; index: number }[] = [];
  private readList: unknown[] | null = null;
  private readListIndex: number = 0;
  private readMapDict: JsonObj | null = null;
  private readMapKeys: string[] = [];
  private readMapIndex: number = 0;
  private readMapReadingKey: boolean = true;
  private readMapCurrentKey: string = '';
  private currentReadField: { key: string; value: unknown } | null = null;

  constructor(
    payload: string | JsonObj,
    isReadMode: boolean = true
  ) {
    if (isReadMode) {
      this.readRoot =
        typeof payload === 'string'
          ? (JSON.parse(payload || '{}') as JsonObj)
          : payload;
    }
  }

  private writeValueToCurrent(value: JsonValue): void {
    if (this.mapStack.length > 0) {
      const top = this.mapStack[this.mapStack.length - 1];
      if (top) {
        if (top.pendingKey === null) {
          top.pendingKey = String(value);
        } else {
          top.map[top.pendingKey] = wrapValueForMap(value as JsonValue) as JsonObj;
          top.pendingKey = null;
        }
      }
      return;
    }
    if (this.listStack.length > 0) {
      const lst = this.listStack[this.listStack.length - 1];
      if (lst) lst.push(value);
      return;
    }
    const parent = this.writeStack[this.writeStack.length - 1];
    if (parent) parent[this.currentFieldKey] = wrapValue(this.currentFieldType, value);
  }

  // --- Write ---
  writeStructBegin(_struct: DpStruct): void {
    this.writeStack.push({});
  }

  writeStructEnd(): void {
    const top = this.writeStack.pop();
    if (!top) return;
    if (this.mapStack.length > 0) {
      const outer = this.mapStack[this.mapStack.length - 1];
      if (outer) {
        outer.map[outer.pendingKey ?? ''] = top;
        outer.pendingKey = null;
      }
    } else if (this.listStack.length > 0) {
      const lst = this.listStack[this.listStack.length - 1];
      if (lst) lst.push(top);
    } else if (this.writeStack.length > 0) {
      const parent = this.writeStack[this.writeStack.length - 1];
      if (parent) parent[this.currentFieldKey] = top;
    } else {
      this.output = JSON.stringify(top);
    }
  }

  writeFieldBegin(field: DpField): void {
    this.currentFieldKey = String(field.id);
    this.currentFieldType = field.type;
  }

  writeFieldEnd(): void {}
  writeFieldStop(): void {}

  writeBool(value: boolean): void {
    this.writeValueToCurrent(value);
  }
  writeByte(value: number): void {
    this.writeValueToCurrent(value);
  }
  writeI16(value: number): void {
    this.writeValueToCurrent(value);
  }
  writeI32(value: number): void {
    this.writeValueToCurrent(value);
  }
  writeI64(value: bigint): void {
    this.writeValueToCurrent(Number(value));
  }
  writeDouble(value: number): void {
    this.writeValueToCurrent(value);
  }
  writeString(value: string): void {
    this.writeValueToCurrent(value ?? '');
  }
  writeBinary(value: Uint8Array): void {
    let b64 = '';
    if (typeof btoa !== 'undefined') {
      b64 = btoa(String.fromCharCode(...value));
    } else {
      b64 = Buffer.from(value).toString('base64');
    }
    this.writeValueToCurrent(b64);
  }

  writeListBegin(_list: DpList): void {
    this.listStack.push([]);
  }
  writeListEnd(): void {
    const list = this.listStack.pop();
    if (list === undefined) return;
    const wrapper = { lst: list };
    if (this.mapStack.length > 0) {
      const outer = this.mapStack[this.mapStack.length - 1];
      if (outer) {
        outer.map[outer.pendingKey ?? ''] = wrapper;
        outer.pendingKey = null;
      }
    } else if (this.listStack.length > 0) {
      const lst = this.listStack[this.listStack.length - 1];
      if (lst) lst.push(list);
    } else {
      const parent = this.writeStack[this.writeStack.length - 1];
      if (parent) parent[this.currentFieldKey] = wrapper;
    }
  }
  writeSetBegin(set: DpSet): void {
    this.writeListBegin({ elementType: set.elementType, count: set.count });
  }
  writeSetEnd(): void {
    this.writeListEnd();
  }
  writeMapBegin(_map: DpMap): void {
    this.mapStack.push({ map: {}, pendingKey: null });
  }
  writeMapEnd(): void {
    const state = this.mapStack.pop();
    if (!state) return;
    const wrapper = { map: state.map };
    if (this.mapStack.length > 0) {
      const outer = this.mapStack[this.mapStack.length - 1];
      if (outer) {
        outer.map[outer.pendingKey ?? ''] = wrapper;
        outer.pendingKey = null;
      }
    } else if (this.listStack.length > 0) {
      const lst = this.listStack[this.listStack.length - 1];
      if (lst) lst.push(wrapper);
    } else {
      const parent = this.writeStack[this.writeStack.length - 1];
      if (parent) parent[this.currentFieldKey] = wrapper;
    }
  }

  // --- Read ---
  readStructBegin(): DpStruct {
    if (this.readStack.length === 0) {
      this.readStack.push({
        obj: this.readRoot ?? {},
        keys: Object.keys(this.readRoot ?? {}),
        index: 0
      });
    } else if (
      this.readList !== null &&
      this.readListIndex < this.readList.length
    ) {
      const next = this.readList[this.readListIndex++] as JsonObj;
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        this.readStack.push({
          obj: next,
          keys: Object.keys(next),
          index: 0
        });
      }
    } else if (
      this.readMapDict !== null &&
      !this.readMapReadingKey &&
      this.readMapIndex < this.readMapKeys.length
    ) {
      const mapVal = this.readMapDict[this.readMapCurrentKey];
      if (mapVal && typeof mapVal === 'object' && !Array.isArray(mapVal)) {
        this.readStack.push({
          obj: mapVal as JsonObj,
          keys: Object.keys(mapVal as JsonObj),
          index: 0
        });
        this.readMapIndex++;
        this.readMapReadingKey = true;
      }
    } else if (this.currentReadField?.value && typeof this.currentReadField.value === 'object' && !Array.isArray(this.currentReadField.value)) {
      this.readStack.push({
        obj: this.currentReadField.value as JsonObj,
        keys: Object.keys(this.currentReadField.value as JsonObj),
        index: 0
      });
    }
    return { name: '' };
  }

  readStructEnd(): void {
    if (this.readStack.length > 0) this.readStack.pop();
  }

  readFieldBegin(): DpField {
    if (this.readStack.length === 0)
      return { name: '', type: DpWireType.Stop, id: 0 };
    const cur = this.readStack[this.readStack.length - 1];
    if (!cur || cur.index >= cur.keys.length)
      return { name: '', type: DpWireType.Stop, id: 0 };
    const key = cur.keys[cur.index++] ?? '';
    const raw = cur.obj[key];
    this.currentReadField = { key, value: raw };
    if (raw === null || raw === undefined) {
      return { name: key, type: DpWireType.String, id: parseInt(key, 10) || 0 };
    }
    let t = DpWireType.Stop;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as JsonObj;
      if ('tf' in obj) t = DpWireType.Bool;
      else if ('i8' in obj || 'i16' in obj || 'i32' in obj) t = DpWireType.I32;
      else if ('i64' in obj) t = DpWireType.I64;
      else if ('dbl' in obj) t = DpWireType.Double;
      else if ('str' in obj) t = DpWireType.String;
      else if ('rec' in obj) t = DpWireType.Struct;
      else if ('lst' in obj || 'set' in obj) {
        t = DpWireType.List;
        const listVal = obj['lst'] ?? obj['set'];
        this.readList = Array.isArray(listVal) ? listVal : [];
        this.readListIndex = 0;
      } else if ('map' in obj) {
        t = DpWireType.Map;
        const mapVal = obj['map'] as JsonObj;
        this.readMapDict = mapVal && typeof mapVal === 'object' ? mapVal : {};
        this.readMapKeys = Object.keys(this.readMapDict);
        this.readMapIndex = 0;
        this.readMapReadingKey = true;
      }
    }
    return {
      name: key,
      type: t,
      id: parseInt(key, 10) || 0
    };
  }
  readFieldEnd(): void {}

  private readSingleValue(key: string): unknown {
    if (
      this.readMapDict !== null &&
      this.readMapIndex < this.readMapKeys.length
    ) {
      if (this.readMapReadingKey) {
        this.readMapCurrentKey = this.readMapKeys[this.readMapIndex] ?? '';
        this.readMapReadingKey = false;
        return this.readMapCurrentKey;
      }
      const valObj = this.readMapDict[this.readMapCurrentKey];
      const v = this.extractFromWrapper(valObj, key);
      this.readMapIndex++;
      this.readMapReadingKey = true;
      return v;
    }
    if (
      this.readList !== null &&
      this.readListIndex < this.readList.length
    ) {
      const raw = this.readList[this.readListIndex++];
      return this.extractFromWrapper(raw, key);
    }
    if (this.currentReadField?.value != null) {
      return this.extractFromWrapper(this.currentReadField.value, key);
    }
    return null;
  }

  private extractFromWrapper(raw: unknown, key: string): unknown {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as JsonObj;
      if (obj[key] !== undefined) return obj[key];
      const k = key === 'i32' ? ['i32', 'i64', 'i8', 'i16'] : [key];
      for (const kk of k) {
        if (obj[kk] !== undefined) return obj[kk];
      }
    }
    return raw;
  }

  readBool(): boolean {
    const v = this.readSingleValue('tf');
    return Boolean(v);
  }
  readByte(): number {
    const v = this.readSingleValue('i8');
    return Number(v ?? 0);
  }
  readI16(): number {
    const v = this.readSingleValue('i16');
    return Number(v ?? 0);
  }
  readI32(): number {
    const v = this.readSingleValue('i32');
    return Number(v ?? 0);
  }
  readI64(): bigint {
    const v = this.readSingleValue('i64');
    return BigInt(Number(v ?? 0));
  }
  readDouble(): number {
    const v = this.readSingleValue('dbl');
    return Number(v ?? 0);
  }
  readString(): string {
    const v = this.readSingleValue('str');
    return v != null ? String(v) : '';
  }
  readBinary(): Uint8Array {
    const s = this.readSingleValue('str');
    if (typeof s !== 'string' || !s) return new Uint8Array(0);
    try {
      if (typeof atob !== 'undefined') {
        const bin = atob(s);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }
      return new Uint8Array(Buffer.from(s, 'base64'));
    } catch {
      return new Uint8Array(0);
    }
  }

  readListBegin(): DpList {
    const count = this.readList?.length ?? 0;
    return { elementType: DpWireType.String, count };
  }
  readListEnd(): void {
    this.readList = null;
  }
  readSetBegin(): DpSet {
    const l = this.readListBegin();
    return { elementType: l.elementType, count: l.count };
  }
  readSetEnd(): void {
    this.readListEnd();
  }
  readMapBegin(): DpMap {
    const count = this.readMapDict ? this.readMapKeys.length : 0;
    return { keyType: DpWireType.String, valueType: DpWireType.String, count };
  }
  readMapEnd(): void {
    this.readMapDict = null;
    this.readMapKeys = [];
  }

  getOutput(): string {
    return this.output;
  }
}
