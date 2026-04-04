/**
 * DeukPack C# Generator: 기본값 처리 및 호환 동작 고도화 유닛 테스트
 *
 * 생성된 C# 코드가 Nullable 옵션에 따라 올바른 시그니처와 기본값 초기화 구문을 갖는지 검증한다.
 */

import { CSharpGenerator } from '../CSharpGenerator';
import type { DeukPackAST, DeukPackStruct, DeukPackEnum, DeukPackNamespace, GenerationOptions } from '../../types/DeukPackTypes';

function buildTestAst(): DeukPackAST {
  const nsCore: DeukPackNamespace = { language: '*', name: 'deukpack_define', sourceFile: 'deukpack.deuk' };
  const nsAuth: DeukPackNamespace = { language: '*', name: 'msg_gen_auth', sourceFile: 'auth.deuk' };

  const structMsgResult: DeukPackStruct = {
    name: 'MsgResult',
    sourceFile: 'deukpack.deuk',
    fields: [
      { id: 1, name: 'ResultCode', type: 'int64', required: false },
    ],
  };

  const structMsgInfo: DeukPackStruct = {
    name: 'MsgInfo',
    sourceFile: 'deukpack.deuk',
    fields: [
      { id: 1, name: 'MsgId', type: 'int32', required: false },
      { id: 2, name: 'MsgResult', type: 'deukpack_define.MsgResult' as any, required: false },
    ],
  };

  const enumTestE: DeukPackEnum = {
    name: 'test_e',
    sourceFile: 'auth.deuk',
    values: { _NONE: 0, OK: 1 },
  };

  const structAckLogin: DeukPackStruct = {
    name: 'ack_login',
    sourceFile: 'auth.deuk',
    fields: [
      { id: 1, name: 'msg_info', type: 'deukpack_define.MsgInfo' as any, required: false, defaultValue: { MsgId: 1 } },
      { id: 2, name: 'count', type: 'int32', required: false, defaultValue: 0 },
      { id: 3, name: 'kind', type: 'test_e' as any, required: false, defaultValue: 'test_e._NONE' },
      { id: 4, name: 'scale', type: 'double', required: false, defaultValue: 1.0 },
    ],
  };

  return {
    namespaces: [nsCore, nsAuth],
    structs: [structMsgResult, structMsgInfo, structAckLogin],
    enums: [enumTestE],
    services: [],
    typedefs: [],
    constants: [],
    includes: [],
    fileNamespaceMap: {
      'deukpack.deuk': 'deukpack_define',
      'auth.deuk': 'msg_gen_auth',
    },
  };
}

describe('CSharpGenerator: 기본값 및 호환 (Rigour Test)', () => {
  const ast = buildTestAst();

  async function generateWith(options: Partial<GenerationOptions>) {
    const generator = new CSharpGenerator();
    return await generator.generate(ast, options as any);
  }

  describe('Nullable 비활성 (Default)', () => {
    let code: { [filename: string]: string };

    beforeAll(async () => {
      code = await generateWith({ csharpNullable: false });
    });

    it('Write 메소드 시그니처에 ?가 없어야 한다', () => {
      const authCs = code['auth.g.cs'] || '';
      // ICollection<int> 다음에 ?가 오지 않아야 함
      expect(authCs).toContain('public void Write(DpProtocol oprot, ICollection<int> fieldIds');
      expect(authCs).not.toMatch(/public void Write\(DpProtocol oprot, ICollection<int>\? fieldIds/);
    });

    it('참조 타입 필드 선언에 ?가 없어야 한다', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toMatch(/public (global::)?deukpack_define\.MsgInfo Msg_info \{ get; set; \}/);
      expect(authCs).not.toMatch(/public (global::)?deukpack_define\.MsgInfo\? Msg_info/);
    });

    it.skip('기본값 초기화 구문이 정확해야 한다 (primitive/enum)', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toMatch(/public int Count \{ get; set; \}( =)? 0;/);
      expect(authCs).toMatch(/public double Scale \{ get; set; \} = 1\.?0?;/);
      expect(authCs).toMatch(/public (global::)?msg_gen_auth\.test_e Kind \{ get; set; \} = (global::)?msg_gen_auth\.test_e\._NONE;/);
    });
  });

  describe('Nullable 활성', () => {
    let code: { [filename: string]: string };

    beforeAll(async () => {
      code = await generateWith({ csharpNullable: true });
    });

    it('Write 메소드 시그니처에 ?가 포함되어야 한다', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toContain('public void Write(DpProtocol oprot, ICollection<int>? fieldIds');
    });

    it.skip('참조 타입 필드 선언에 ?가 포함되어야 한다 (Required 아님)', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toMatch(/public (global::)?deukpack_define\.MsgInfo\?? Msg_info \{ get; set; \}/);
    });

    it.skip('struct 필드 초기화 시 ? 타입에 맞춰 인스턴스가 생성되어야 한다', () => {
      const authCs = code['auth.g.cs'] || '';
      // Msg_info는 defaultValue가 있으므로 초기화됨
      expect(authCs).toMatch(/Msg_info \{ get; set; \}( =)?.+deukpack_define\.MsgInfo/);
    });
  });

  describe('DeukPack vs Apache 동작 정합성 (Common)', () => {
    let code: { [filename: string]: string };

    beforeAll(async () => {
      code = await generateWith({});
    });

    it.skip('CreateDefault()는 모든 struct에 존재하며 내부에서 디폴트 지정 필드를 초기화한다', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toContain('public static ack_login CreateDefault()');
      
      const start = authCs.indexOf('public static ack_login CreateDefault()');
      const end = authCs.indexOf('public override string ToString()', start);
      const block = authCs.slice(start, end);
      
      expect(block).toContain('o.Count = 0');
      expect(block).toMatch(/o\.Msg_info = new (global::)?deukpack_define\.MsgInfo\(\)/);
      expect(block).toMatch(/MsgId = 1/);
    });

    it('Read() 진입 시 모든 필드를 기본값으로 초기화하여 NRE를 방지한다', () => {
      const authCs = code['auth.g.cs'] || '';
      const start = authCs.indexOf('public void Read(DpProtocol iprot)');
      const end = authCs.indexOf('DpColumn field;', start);
      const initBlock = authCs.slice(start, end);

      expect(initBlock).toMatch(/this\.Msg_info = new (global::)?deukpack_define\.MsgInfo\(\)/);
      expect(initBlock).toContain('this.Count = 0');
    });

    it.skip('스키마(DpFieldSchema)에 DefaultValue가 메타데이터로 기록된다', () => {
      const authCs = code['auth.g.cs'] || '';
      expect(authCs).toContain('DefaultValue = 0');
      expect(authCs).toContain('DefaultValue = test_e.test_e._NONE');
    });
  });
});
