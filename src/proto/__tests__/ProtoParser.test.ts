import * as fs from 'fs';
import * as path from 'path';
import { ProtoLexer } from '../ProtoLexer';
import { ProtoASTBuilder } from '../ProtoASTBuilder';
import { ProtoTokenType } from '../ProtoTypes';

describe('ProtoParser Phase 2: Hero Saga Complex Validation', () => {
  let lexer: ProtoLexer;
  let builder: ProtoASTBuilder;

  beforeEach(() => {
    lexer = new ProtoLexer();
    builder = new ProtoASTBuilder();
  });

  it('should correctly parse hero_saga.proto with nested and oneof structures', () => {
    const protoPath = path.resolve(__dirname, '../../../../DeukPack/examples/proto/hero_saga.proto');
    const content = fs.readFileSync(protoPath, 'utf-8');
    
    const tokens = lexer.tokenize(content);
    const ast = builder.build(tokens, 'hero_saga.proto');

    // 1. Verify nested structs (Message flattening)
    const abilityStruct = ast.structs.find(s => s.name === 'Hero_Ability');
    expect(abilityStruct).toBeDefined();
    expect(abilityStruct?.fields.some(f => f.name === 'strength')).toBe(true);

    const professionEnum = ast.enums.find(e => e.name === 'Hero_Role');
    expect(professionEnum).toBeDefined();
    expect(professionEnum?.values['PALADIN']).toBe(0);

    const gradeEnum = ast.enums.find(e => e.name === 'Hero_Ability_Grade');
    expect(gradeEnum).toBeDefined();

    // 2. Verify oneof flattening
    const heroStruct = ast.structs.find(s => s.name === 'Hero');
    expect(heroStruct).toBeDefined();
    // primary_weapon and main_armor should be in the fields list
    expect(heroStruct?.fields.some(f => f.name === 'primary_weapon')).toBe(true);
    expect(heroStruct?.fields.some(f => f.name === 'main_armor')).toBe(true);

    // 3. Verify doc comments
    expect(heroStruct?.docComment).toContain('영웅의 서사시');
    const nameField = heroStruct?.fields.find(f => f.name === 'name');
    expect(nameField?.docComment).toBe('영웅의 이름');

    // 4. Verify Services
    const sagaService = ast.services.find(s => s.name === 'SagaService');
    expect(sagaService).toBeDefined();
    const method = sagaService!.methods[0]!;
    expect(method.name).toBe('EmbarkQuest');
    expect(method.docComment).toContain('퀘스트를 수락하고');
  });
});
