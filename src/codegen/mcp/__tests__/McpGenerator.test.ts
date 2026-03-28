import { McpGenerator } from '../McpGenerator';
import { DeukPackAST, DeukPackNamespace, DeukPackStruct, DeukPackService } from '../../../types/DeukPackTypes';

function buildMcpTestAst(): DeukPackAST {
  const ns: DeukPackNamespace = { language: 'ts', name: 'Test', sourceFile: 'test.deuk' };

  const structUserInfo: DeukPackStruct = {
    name: 'UserInfo',
    sourceFile: 'test.deuk',
    docComment: 'User information structure',
    fields: [
      { id: 1, name: 'id', type: 'int32', required: true },
      { id: 2, name: 'name', type: 'string', required: true },
    ],
  };

  const serviceAuth: DeukPackService = {
    name: 'AuthService',
    methods: [
      {
        name: 'login',
        docComment: 'Login method',
        returnType: 'UserInfo' as any,
        parameters: [
          { id: 1, name: 'username', type: 'string', required: true },
          { id: 2, name: 'password', type: 'string', required: true },
        ],
        oneway: false
      },
      {
        name: 'logout',
        returnType: 'bool' as any,
        parameters: [
          { id: 1, name: 'userId', type: 'int32', required: true },
        ],
        oneway: false
      },
      {
        name: 'secretMethod',
        annotations: { 'mcp.hidden': 'true' },
        returnType: 'bool' as any,
        parameters: [],
        oneway: false
      }
    ]
  };

  const structSecretInfo: DeukPackStruct = {
    name: 'SecretInfo',
    annotations: { 'hidden': 'true' },
    fields: []
  };

  return {
    namespaces: [ns],
    structs: [structUserInfo, structSecretInfo],
    enums: [],
    services: [serviceAuth],
    typedefs: [],
    constants: [],
    includes: [],
  };
}

describe('McpGenerator', () => {
  it('should generate mcp-server.ts and respect [hidden] annotations', async () => {
    const ast = buildMcpTestAst();
    const generator = new McpGenerator();
    const generated = await generator.generate(ast, {} as any);

    const mcpTs = generated['mcp-server.ts'];
    expect(mcpTs).toBeDefined();

    // Verify Resources
    expect(mcpTs).toContain('"UserInfo"');
    expect(mcpTs).not.toContain('"SecretInfo"');

    // Verify Tools
    expect(mcpTs).toContain('"AuthService_login"');
    expect(mcpTs).not.toContain('"AuthService_secretMethod"');

    // Verify Zod Type for int32/int64
    expect(mcpTs).toContain('userId: z.number()');
  });
});
