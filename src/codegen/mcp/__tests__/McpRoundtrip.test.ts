import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ProtoParser } from '../../../core/ProtoParser';
import { McpGenerator } from '../McpGenerator';

describe('MCP CodeGen Phase 2: Round-trip E2E Validation', () => {
    const tempDir = path.resolve(__dirname, '../../../../mcp_test_run');
    let childProcess: ChildProcess;
    let client: Client;

    beforeAll(async () => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // 0. Create package.json for ESM support
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }));

        // 1. Parse hero_saga.proto
        const protoPath = path.resolve(__dirname, '../../../../examples/proto/hero_saga.proto');
        const parser = new ProtoParser();
        const content = fs.readFileSync(protoPath, 'utf-8');
        const ast = parser.parse(content, protoPath);

        // 2. Generate MCP Server
        const generator = new McpGenerator();
        const generated = await generator.generate(ast, { targetDir: tempDir } as any);
        const serverCode = generated['mcp-server.ts']!;
        fs.writeFileSync(path.join(tempDir, 'mcp-server.ts'), serverCode);

        // 3. Create Runner with Mock Service
        const runnerCode = `
import { registerService } from './mcp-server';

registerService('SagaService', {
  EmbarkQuest: async (args) => {
    return { 
      success: true, 
      message: "Hero " + args.hero_id + " embarked to " + args.location, 
      rewards: ['XP', 'Gold'] 
    };
  }
});
`;
        fs.writeFileSync(path.join(tempDir, 'runner.ts'), runnerCode);

        // 4. Connect Client using StdioClientTransport's own process management
        const tsxCliPath = path.resolve(__dirname, '../../../../node_modules/tsx/dist/cli.mjs');
        
        const env = { ...process.env, NO_UPDATE_NOTIFIER: '1' };
        const filteredEnv: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
            if (value !== undefined) filteredEnv[key] = value;
        }

        const transport = new StdioClientTransport({
            command: 'node',
            args: [tsxCliPath, 'runner.ts'],
            cwd: tempDir,
            env: filteredEnv
        });

        client = new Client(
            { name: "test-client", version: "1.0.0" },
            { capabilities: {} }
        );

        await client.connect(transport);
    }, 40000);

    afterAll(async () => {
        if (client) await client.close();
        // Give it time to die on Windows
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Keep tempDir for debugging
        console.log(`Test artifacts kept at: ${tempDir}`);
    });

    it('should list SagaService_EmbarkQuest as an available tool', async () => {
        const tools = await client.listTools();
        expect(tools.tools.some(t => t.name === 'SagaService_EmbarkQuest')).toBe(true);
    });

    it('should successfully call SagaService_EmbarkQuest and get response from mock', async () => {
        const result = await client.callTool({
            name: 'SagaService_EmbarkQuest',
            arguments: {
                req: {
                    hero_id: 42,
                    location: 'Stormwind'
                }
            }
        });

        expect(result.content).toBeDefined();
        const textContent = (result.content as any)[0].text;
        const parsed = JSON.parse(textContent);
        
        expect(parsed.success).toBe(true);
        expect(parsed.message).toBe("Hero 42 embarked to Stormwind");
        expect(parsed.rewards).toContain('XP');
    });
});
