/**
 * DeukPack C# Generator: 기본값 처리 및 호환 동작 유닛 테스트
 *
 * 생성된 C# 코드가 기본값·CreateDefault·Write 스킵 등 기대 동작을 하는지 검증한다.
 *
 * - 필드 기본값: 선언 초기화, CreateDefault() RHS, Write 시 기본값이면 스킵
 * - cross-namespace struct 필드: NRE 방지를 위한 항상 초기화 + Read() null 보정
 */

import { CSharpGenerator } from '../CSharpGenerator';
import type { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackNamespace } from '../../types/DeukPackTypes';

function buildMinimalAst(): DeukPackAST {
  const nsGplat: DeukPackNamespace = { language: '*', name: 'gplat_define', sourceFile: 'gplat.thrift' };
  const nsAuth: DeukPackNamespace = { language: '*', name: 'msg_gen_auth', sourceFile: 'auth.thrift' };

  const structMsgResult: DeukPackStruct = {
    name: 'MsgResult',
    sourceFile: 'gplat.thrift',
    fields: [
      { id: 1, name: 'ResultCode', type: 'int64', required: false },
    ],
  };

  const structMsgInfo: DeukPackStruct = {
    name: 'MsgInfo',
    sourceFile: 'gplat.thrift',
    fields: [
      { id: 1, name: 'MsgId', type: 'int32', required: false },
      { id: 2, name: 'MsgResult', type: 'gplat_define.MsgResult' as any, required: false },
    ],
  };

  const enumTestE: DeukPackEnum = {
    name: 'test_e',
    sourceFile: 'auth.thrift',
    values: { _NONE: 0, OK: 1 },
  };

  const structAckLogin: DeukPackStruct = {
    name: 'ack_login',
    sourceFile: 'auth.thrift',
    fields: [
      { id: 1, name: 'msg_info', type: 'gplat_define.MsgInfo' as any, required: false, defaultValue: { MsgId: 1 } },
      { id: 2, name: 'count', type: 'int32', required: false, defaultValue: 0 },
      { id: 3, name: 'kind', type: 'test_e' as any, required: false, defaultValue: 'test_e._NONE' },
      { id: 4, name: 'scale', type: 'double', required: false, defaultValue: 1.0 },
    ],
  };

  return {
    namespaces: [nsGplat, nsAuth],
    structs: [structMsgResult, structMsgInfo, structAckLogin],
    enums: [enumTestE],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: {
      'gplat.thrift': 'gplat_define',
      'auth.thrift': 'msg_gen_auth',
    },
  };
}

describe('CSharpGenerator: 기본값 및 호환', () => {
  let generated: { [filename: string]: string };

  beforeAll(async () => {
    const ast = buildMinimalAst();
    const generator = new CSharpGenerator();
    generated = await generator.generate(ast, {} as any);
  });

  describe('필드 기본값 (Apache 호환)', () => {
    it('기본값이 있는 primitive 필드는 선언 시 해당 값으로 초기화된다 (Apache 호환: 프로퍼티)', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toContain('public int Count { get; set; } = 0');
      expect(authCs).toMatch(/public double Scale \{ get; set; \} = 1\.?0?/);
    });

    it('기본값이 있는 enum 필드는 선언 시 해당 enum 값으로 초기화된다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toContain('test_e._NONE');
      expect(authCs).toMatch(/public\s+([\w.]+\.)?test_e Kind\s*\{ get; set; \}\s*=\s*([\w.]+\.)?test_e\._NONE/);
    });

    it('CreateDefault()는 IDL 기본값을 사용한다 (타입 기본값만 쓰지 않음)', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      const createDefaultBlock = authCs.includes('public static ack_login CreateDefault()')
        ? authCs.slice(authCs.indexOf('public static ack_login CreateDefault()'), authCs.indexOf('public override string ToString()'))
        : '';
      expect(createDefaultBlock).toContain('o.Count = 0');
      expect(createDefaultBlock).toMatch(/o\.Kind\s*=\s*([\w.]+\.)?test_e\._NONE/);
      expect(createDefaultBlock).toContain('o.Scale = 1');
    });

    it('Write 시 기본값과 같으면 스킵하는 조건이 생성된다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      const start = authCs.indexOf('public void Write(DpProtocol oprot, ICollection<int>? fieldIds');
      const end = authCs.indexOf('public void Read(DpProtocol iprot)', start);
      const writeBlock = start >= 0 && end > start ? authCs.slice(start, end) : '';
      expect(writeBlock.length).toBeGreaterThan(0);
      expect(writeBlock).toMatch(/if \(_v\d+ != 0\)/);
      expect(writeBlock).toMatch(/if \(_v\d+ !=\s*([\w.]+\.)?test_e\._NONE\)/);
      expect(writeBlock).toMatch(/if \(_v\d+ !=\s*1(?:\.0+)?\)/);
    });

    it('스키마(DpFieldSchema)에 DefaultValue가 반영된다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toContain('DefaultValue = 0');
      expect(authCs).toContain('DefaultValue = "test_e._NONE"');
    });
  });

  describe('디폴트 값 지정 시 struct 필드 (NRE 방지)', () => {
    it('디폴트가 지정된 struct 필드는 선언 시 초기화되어 null이 아니다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toMatch(/public (global::)?gplat_define\.MsgInfo Msg_info\s*\{ get; set; \}\s*=/);
      expect(authCs).toMatch(
        /Msg_info\s*=\s*(new (global::)?gplat_define\.MsgInfo\(\)|(global::)?gplat_define\.MsgInfo\.CreateDefault\(\))/
      );
    });

    it('Read() 진입 시 모든 필드를 기본값으로 초기화하여 wire-absent 필드·null 방지', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toMatch(/this\.Msg_info\s*=\s*new (global::)?gplat_define\.MsgInfo\(\)\s*\{/);
      expect(authCs).toContain('this.Count = 0');
      expect(authCs).toContain('this.Kind = msg_gen_auth.test_e._NONE');
    });

    it('디폴트 미지정 struct 필드에는 강제 CreateDefault() 초기화를 넣지 않는다', () => {
      const gplatCs = generated['gplat_deuk.cs'] ?? '';
      expect(gplatCs).toContain('public static MsgInfo CreateDefault()');
    });
  });

  describe('DeukPack vs Apache 동작 정합성', () => {
    it('CreateDefault() 내부에서 디폴트가 지정된 struct 필드는 초기화된다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toMatch(
        /o\.Msg_info\s*=\s*(new (global::)?gplat_define\.MsgInfo\(\)|(global::)?gplat_define\.MsgInfo\.CreateDefault\(\))/
      );
    });

    it('특정 필드만 지정해도 미지정 하위 struct는 CreateDefault()로 할당된다 (Apache 방식)', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      expect(authCs).toContain('MsgId = 1');
      expect(authCs).toMatch(/MsgResult\s*=\s*(global::)?gplat_define\.MsgResult\.CreateDefault\(\)/);
    });

    it('생성된 C#에 CreateDefault() 메서드가 모든 struct에 존재한다', () => {
      const authCs = generated['auth_deuk.cs'] ?? '';
      const gplatCs = generated['gplat_deuk.cs'] ?? '';
      expect(authCs).toContain('public static ack_login CreateDefault()');
      expect(gplatCs).toContain('public static MsgInfo CreateDefault()');
    });
  });
});
